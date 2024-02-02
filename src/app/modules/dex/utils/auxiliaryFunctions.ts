/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/*
 * Copyright © 2024 Lisk Foundation
 *
 * See the LICENSE file at the top-level directory of this distribution
 * for licensing information.
 *
 * Unless otherwise agreed in a custom licensing agreement with the Lisk Foundation,
 * no part of this software, including this file, may be copied, modified,
 * propagated, or distributed except according to the terms contained in the
 * LICENSE file.
 *
 * Removal or modification of this copyright notice is prohibited.
 */

import { MethodContext, TokenMethod, cryptography, ModuleEndpointContext, codec } from 'lisk-sdk';
import { NamedRegistry } from 'lisk-framework/dist-node/modules/named_registry';
import { genesisTokenStoreSchema } from 'lisk-framework/dist-node/modules/token';
import { GenesisTokenStore } from 'lisk-framework/dist-node/modules/token/types';
import { MAX_SINT32 } from '@liskhq/lisk-validator';

import { DexGlobalStore, PoolsStore, PositionsStore, PriceTicksStore } from '../stores';

import {
	NUM_BYTES_ADDRESS,
	NUM_BYTES_TOKEN_ID,
	MODULE_ID_DEX,
	NUM_BYTES_POOL_ID,
	MAX_TICK,
	MIN_TICK,
	POOL_CREATION_FAILED_ALREADY_EXISTS,
	POOL_CREATION_FAILED_INVALID_FEE_TIER,
	POOL_CREATION_SUCCESS,
	POSITION_CREATION_FAILED_INVALID_TICKS,
	POSITION_CREATION_FAILED_INVALID_TICK_SPACING,
	POSITION_CREATION_FAILED_NO_POOL,
	POSITION_CREATION_SUCCESS,
	POSITION_UPDATE_FAILED_INSUFFICIENT_LIQUIDITY,
	POSITION_UPDATE_FAILED_NOT_EXISTS,
	POSITION_UPDATE_FAILED_NOT_OWNER,
	TOKEN_ID_LSK,
	TOKEN_ID_INCENTIVES,
	ADDRESS_LIQUIDITY_PROVIDERS_INCENTIVES_POOL,
	MODULE_NAME_DEX,
	TOKEN_ID_DEX,
	ALL_SUPPORTED_TOKENS_KEY,
	MODULE_NAME_TOKEN,
	ADDRESS_LIQUIDITY_PROVIDER_INCENTIVES,
} from '../constants';

import {
	PoolID,
	PositionID,
	Address,
	TokenID,
	Q96,
	routeInterface,
	AdjacentEdgesInterface,
	TickID,
	TokenDistribution,
} from '../types';

import {
	subQ96,
	mulQ96,
	mulDivQ96,
	numberToQ96,
	roundDownQ96,
	q96ToBytes,
	bytesToQ96,
	invQ96,
} from './q96';

import {
	computeNextPrice,
	getAmount0Delta,
	getAmount1Delta,
	priceToTick,
	tickToPrice,
} from './math';
import { FeesIncentivesCollectedEvent, PositionUpdateFailedEvent } from '../events';
import { DexEndpoint } from '../endpoint';
import { DexModule } from '../module';
import { PriceTicksStoreData, tickToBytes } from '../stores/priceTicksStore';
import { ADDRESS_VALIDATOR_INCENTIVES } from '../../dexIncentives/constants';
import { DexGlobalStoreData } from '../stores/dexGlobalStore';
import { PoolsStoreData } from '../stores/poolsStore';
import { PositionsStoreData } from '../stores/positionsStore';
import { updatePoolIncentives } from './tokenEconomicsFunctions';

const abs = (x: bigint) => (x < BigInt(0) ? -x : x);
const { utils } = cryptography;

export const poolIdToAddress = (poolId: PoolID): Address => {
	const _address: Buffer = utils.hash(poolId);
	return _address.slice(0, NUM_BYTES_ADDRESS);
};

export const getToken0Id = (poolId: PoolID): TokenID => poolId.slice(0, NUM_BYTES_TOKEN_ID);

export const getToken1Id = (poolId: PoolID): TokenID =>
	poolId.slice(NUM_BYTES_TOKEN_ID, 2 * NUM_BYTES_TOKEN_ID);

export const transferToPool = async (
	tokenMethod: TokenMethod,
	methodContext,
	senderAddress: Address,
	poolId: PoolID,
	tokenId: TokenID,
	amount: bigint,
): Promise<void> => {
	const poolAddress = poolIdToAddress(poolId);
	await tokenMethod.transfer(methodContext, senderAddress, poolAddress, tokenId, amount);
	await tokenMethod.lock(methodContext, poolAddress, MODULE_ID_DEX.toString(), tokenId, amount);
};

export const transferFromPool = async (
	tokenMethod: TokenMethod,
	methodContext,
	poolId: PoolID,
	recipientAddress: Address,
	tokenId: TokenID,
	amount: bigint,
): Promise<void> => {
	const poolAddress = poolIdToAddress(poolId);
	await tokenMethod.unlock(methodContext, poolAddress, MODULE_ID_DEX.toString(), tokenId, amount);
	await tokenMethod.transfer(methodContext, poolAddress, recipientAddress, tokenId, amount);
};

export const transferPoolToPool = async (
	tokenMethod: TokenMethod,
	methodContext,
	poolIdSend: PoolID,
	poolIdReceive: PoolID,
	tokenId: TokenID,
	amount: bigint,
): Promise<void> => {
	const poolAddressSend = poolIdToAddress(poolIdSend);
	const poolAddressReceive = poolIdToAddress(poolIdReceive);
	await tokenMethod.unlock(
		methodContext,
		poolAddressSend,
		MODULE_ID_DEX.toString(),
		tokenId,
		amount,
	);
	await tokenMethod.transfer(methodContext, poolAddressSend, poolAddressReceive, tokenId, amount);
	await tokenMethod.lock(
		methodContext,
		poolAddressReceive,
		MODULE_ID_DEX.toString(),
		tokenId,
		amount,
	);
};

export const transferToValidatorLSKPool = async (
	tokenMethod: TokenMethod,
	methodContext,
	senderAddress: Address,
	amount: bigint,
): Promise<void> => {
	await tokenMethod.transfer(
		methodContext,
		senderAddress,
		ADDRESS_VALIDATOR_INCENTIVES,
		TOKEN_ID_LSK,
		amount,
	);
	await tokenMethod.lock(methodContext, senderAddress, MODULE_NAME_DEX, TOKEN_ID_LSK, amount);
};

export const checkPositionExistenceAndOwnership = async (
	stores: NamedRegistry,
	events: NamedRegistry,
	methodContext,
	senderAddress: Address,
	positionID: PositionID,
): Promise<void> => {
	const positionsStore = stores.get(PositionsStore);
	if (!(await positionsStore.hasKey(methodContext, [senderAddress, positionID]))) {
		events.get(PositionUpdateFailedEvent).add(
			methodContext,
			{
				senderAddress,
				positionID,
				result: POSITION_UPDATE_FAILED_NOT_EXISTS,
			},
			[senderAddress],
			true,
		);
		throw new Error();
	}
	if (
		!senderAddress.equals(
			await getOwnerAddressOfPosition(methodContext, positionsStore, positionID),
		)
	) {
		events.get(PositionUpdateFailedEvent).add(
			methodContext,
			{
				senderAddress,
				positionID,
				result: POSITION_UPDATE_FAILED_NOT_OWNER,
			},
			[senderAddress],
			true,
		);
		throw new Error();
	}
};

export const collectFeesAndIncentives = async (
	events: NamedRegistry,
	stores: NamedRegistry,
	tokenMethod,
	methodContext,
	positionID: PositionID,
): Promise<void> => {
	const poolID = getPoolIDFromPositionID(positionID);
	const positionsStore = stores.get(PositionsStore);
	const dexGlobalStore = stores.get(DexGlobalStore);
	const positionInfo = await positionsStore.get(methodContext, positionID);
	const ownerAddress = await getOwnerAddressOfPosition(methodContext, positionsStore, positionID);

	const [collectedFees0, collectedFees1, feeGrowthInside0, feeGrowthInside1] =
		await computeCollectableFees(stores, methodContext, positionID);

	if (collectedFees0 > 0) {
		await transferFromPool(
			tokenMethod,
			methodContext,
			poolID,
			ownerAddress,
			getToken0Id(poolID),
			collectedFees0,
		);
	}
	if (collectedFees1 > 0) {
		await transferFromPool(
			tokenMethod,
			methodContext,
			poolID,
			ownerAddress,
			getToken1Id(poolID),
			collectedFees1,
		);
	}
	positionInfo.feeGrowthInsideLast0 = q96ToBytes(feeGrowthInside0);
	positionInfo.feeGrowthInsideLast1 = q96ToBytes(feeGrowthInside1);

	await positionsStore.set(methodContext, positionID, positionInfo);
	const [_, incentivesForPosition] = await computeCollectableIncentives(
		dexGlobalStore,
		tokenMethod,
		methodContext,
		positionID,
		collectedFees0,
		collectedFees1,
	);

	await tokenMethod.transfer(
		methodContext,
		ADDRESS_LIQUIDITY_PROVIDERS_INCENTIVES_POOL,
		ownerAddress,
		TOKEN_ID_INCENTIVES,
		incentivesForPosition,
	);
	const dexGlobalStoreData = await dexGlobalStore.get(methodContext, Buffer.alloc(0));
	// dexGlobalStoreData.collectableLSKFees -= collectableFeesLSK;
	await dexGlobalStore.set(methodContext, Buffer.alloc(0), dexGlobalStoreData);

	events.get(FeesIncentivesCollectedEvent).log(methodContext, {
		senderAddress: ownerAddress,
		positionID,
		collectedFees0,
		tokenID0: getToken0Id(poolID),
		collectedFees1,
		tokenID1: getToken1Id(poolID),
		collectedIncentives: incentivesForPosition,
		tokenIDIncentives: TOKEN_ID_INCENTIVES,
	});
};

export const computeCollectableFees = async (
	stores: NamedRegistry,
	methodContext,
	positionID: PositionID,
): Promise<[bigint, bigint, Q96, Q96]> => {
	const positionsStore = stores.get(PositionsStore);
	const positionInfo = await positionsStore.get(methodContext, positionID);
	const [feeGrowthInside0, feeGrowthInside1] = await getFeeGrowthInside(
		stores,
		methodContext,
		positionID,
	);

	const collectableFees0 = roundDownQ96(
		mulQ96(
			subQ96(feeGrowthInside0, bytesToQ96(positionInfo.feeGrowthInsideLast0)),
			positionInfo.liquidity,
		),
	);
	const collectableFees1 = roundDownQ96(
		mulQ96(
			subQ96(feeGrowthInside1, bytesToQ96(positionInfo.feeGrowthInsideLast1)),
			positionInfo.liquidity,
		),
	);

	return [collectableFees0, collectableFees1, feeGrowthInside0, feeGrowthInside1];
};

export const computeCollectableIncentives = async (
	dexGlobalStore,
	tokenMethod,
	methodContext,
	positionID: PositionID,
	collectableFees0: bigint,
	collectableFees1: bigint,
): Promise<[bigint, bigint]> => {
	const poolID = getPoolIDFromPositionID(positionID);
	let collectableFeesLSK = BigInt(0);
	if (getToken0Id(poolID).equals(TOKEN_ID_LSK)) {
		collectableFeesLSK = collectableFees0;
	} else if (getToken1Id(poolID).equals(TOKEN_ID_LSK)) {
		collectableFeesLSK = collectableFees1;
	}

	if (collectableFeesLSK === BigInt(0)) {
		return [BigInt(0), BigInt(0)];
	}
	// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
	const dexGlobalStoreData = await dexGlobalStore.get(methodContext, Buffer.from([]));
	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	const totalCollectableLSKFees = dexGlobalStoreData.collectableLSKFees;
	const availableLPIncentives = await tokenMethod.getAvailableBalance(
		methodContext,
		ADDRESS_LIQUIDITY_PROVIDERS_INCENTIVES_POOL,
		TOKEN_ID_INCENTIVES,
	);
	const incentivesForPosition =
		(availableLPIncentives * collectableFeesLSK) / totalCollectableLSKFees;
	return [collectableFeesLSK, incentivesForPosition];
};

export const computePoolID = (tokenID0: TokenID, tokenID1: TokenID, feeTier: number): Buffer => {
	const feeTierBuffer = Buffer.alloc(4);
	feeTierBuffer.writeInt8(feeTier, 0);
	// feeTierBuffer.writeUInt32BE(feeTier, 0);
	return Buffer.concat([tokenID0, tokenID1, feeTierBuffer]);
};

export const createPool = async (
	settings,
	methodContext,
	poolsStore: PoolsStore,
	tokenID0: TokenID,
	tokenID1: TokenID,
	feeTier: number,
	initialSqrtPrice: Q96,
	currentHeight: number,
): Promise<number> => {
	const poolSetting = settings.feeTiers[feeTier];

	if (!poolSetting) {
		return POOL_CREATION_FAILED_INVALID_FEE_TIER;
	}

	const poolID = computePoolID(tokenID0, tokenID1, feeTier);
	if (await poolsStore.has(methodContext, poolID)) {
		return POOL_CREATION_FAILED_ALREADY_EXISTS;
	}

	const poolStoreValue = {
		liquidity: BigInt(0),
		sqrtPrice: q96ToBytes(initialSqrtPrice),
		incentivesPerLiquidityAccumulator: q96ToBytes(numberToQ96(BigInt(0))),
		heightIncentivesUpdate: currentHeight,
		feeGrowthGlobal0: q96ToBytes(numberToQ96(BigInt(0))),
		feeGrowthGlobal1: q96ToBytes(numberToQ96(BigInt(0))),
		protocolFees0: numberToQ96(BigInt(0)),
		protocolFees1: numberToQ96(BigInt(0)),
		tickSpacing: poolSetting,
	};
	await poolsStore.set(methodContext, poolID, poolStoreValue);
	return POOL_CREATION_SUCCESS;
};

export const createPosition = async (
	methodContext: MethodContext,
	stores: NamedRegistry,
	senderAddress: Address,
	poolID: PoolID,
	tickLower: number,
	tickUpper: number,
): Promise<[number, PositionID]> => {
	const dexGlobalStore = stores.get(DexGlobalStore);
	const poolsStore = stores.get(PoolsStore);
	const positionsStore = stores.get(PositionsStore);
	const priceTicksStore = stores.get(PriceTicksStore);
	if (!(await poolsStore.hasKey(methodContext, [poolID]))) {
		return [POSITION_CREATION_FAILED_NO_POOL, Buffer.from([])];
	}
	const currentPool = await poolsStore.get(methodContext, poolID);

	if (MIN_TICK > tickLower || tickLower >= tickUpper || tickUpper > MAX_TICK) {
		return [POSITION_CREATION_FAILED_INVALID_TICKS, Buffer.from([])];
	}

	if (tickLower % currentPool.tickSpacing !== 0 || tickUpper % currentPool.tickSpacing !== 0) {
		return [POSITION_CREATION_FAILED_INVALID_TICK_SPACING, Buffer.from([])];
	}

	if (!(await priceTicksStore.hasKey(methodContext, [poolID, tickToBytes(tickLower)]))) {
		const tickStoreValue = {
			liquidityNet: BigInt(0),
			liquidityGross: BigInt(0),
			feeGrowthOutside0: q96ToBytes(numberToQ96(BigInt(0))),
			feeGrowthOutside1: q96ToBytes(numberToQ96(BigInt(0))),
			incentivesPerLiquidityOutside: q96ToBytes(BigInt(0)),
		};
		if (bytesToQ96(currentPool.sqrtPrice) >= tickToPrice(tickLower)) {
			tickStoreValue.feeGrowthOutside0 = currentPool.feeGrowthGlobal0;
			tickStoreValue.feeGrowthOutside1 = currentPool.feeGrowthGlobal1;
		}

		await priceTicksStore.setKey(methodContext, [poolID, tickToBytes(tickLower)], tickStoreValue);
	}

	if (!(await priceTicksStore.hasKey(methodContext, [poolID, tickToBytes(tickUpper)]))) {
		const tickStoreValue = {
			liquidityNet: BigInt(0),
			liquidityGross: BigInt(0),
			feeGrowthOutside0: q96ToBytes(numberToQ96(BigInt(0))),
			feeGrowthOutside1: q96ToBytes(numberToQ96(BigInt(0))),
			incentivesPerLiquidityOutside: q96ToBytes(BigInt(0)),
		};
		if (bytesToQ96(currentPool.sqrtPrice) >= tickToPrice(tickUpper)) {
			tickStoreValue.feeGrowthOutside0 = currentPool.feeGrowthGlobal0;
			tickStoreValue.feeGrowthOutside1 = currentPool.feeGrowthGlobal1;
		}

		await priceTicksStore.setKey(methodContext, [poolID, tickToBytes(tickUpper)], tickStoreValue);
	}

	const dexGlobalStoreData = await dexGlobalStore.get(methodContext, Buffer.from([]));
	const positionID = getNewPositionID(dexGlobalStoreData, poolID);

	const positionValue = {
		tickLower,
		tickUpper,
		liquidity: BigInt(0),
		feeGrowthInsideLast0: q96ToBytes(numberToQ96(BigInt(0))),
		feeGrowthInsideLast1: q96ToBytes(numberToQ96(BigInt(0))),
		ownerAddress: senderAddress,
		incentivesPerLiquidityLast: q96ToBytes(numberToQ96(BigInt(0))),
	};
	await positionsStore.set(methodContext, positionID, positionValue);
	return [POSITION_CREATION_SUCCESS, positionID];
};

export const getFeeGrowthInside = async (
	stores: NamedRegistry,
	methodContext: MethodContext,
	positionID: PositionID,
): Promise<[bigint, bigint]> => {
	const poolsStore = stores.get(PoolsStore);
	const positionsStore = stores.get(PositionsStore);
	const priceTicksStore = stores.get(PriceTicksStore);
	const positionInfo = await positionsStore.get(methodContext, positionID);
	const poolID = getPoolIDFromPositionID(positionID);
	const poolInfo = await poolsStore.get(methodContext, poolID);

	const { tickLower, tickUpper } = positionInfo;
	const tickCurrent = priceToTick(bytesToQ96(poolInfo.sqrtPrice));
	const lowerTickInfo = await priceTicksStore.getKey(methodContext, [
		poolID,
		tickToBytes(tickLower),
	]);
	const upperTickInfo = await priceTicksStore.getKey(methodContext, [
		poolID,
		tickToBytes(tickUpper),
	]);

	let feeGrowthBelow0;
	let feeGrowthBelow1;
	let feeGrowthAbove0;
	let feeGrowthAbove1;

	if (tickCurrent >= tickLower) {
		feeGrowthBelow0 = bytesToQ96(lowerTickInfo.feeGrowthOutside0);
		feeGrowthBelow1 = bytesToQ96(lowerTickInfo.feeGrowthOutside1);
	} else {
		feeGrowthBelow0 = subQ96(
			bytesToQ96(poolInfo.feeGrowthGlobal0),
			bytesToQ96(lowerTickInfo.feeGrowthOutside0),
		);
		feeGrowthBelow1 = subQ96(
			bytesToQ96(poolInfo.feeGrowthGlobal1),
			bytesToQ96(lowerTickInfo.feeGrowthOutside1),
		);
	}

	if (tickCurrent < tickUpper) {
		feeGrowthAbove0 = bytesToQ96(upperTickInfo.feeGrowthOutside0);
		feeGrowthAbove1 = bytesToQ96(upperTickInfo.feeGrowthOutside1);
	} else {
		feeGrowthAbove0 = subQ96(
			bytesToQ96(poolInfo.feeGrowthGlobal0),
			bytesToQ96(upperTickInfo.feeGrowthOutside0),
		);
		feeGrowthAbove1 = subQ96(
			bytesToQ96(poolInfo.feeGrowthGlobal1),
			bytesToQ96(upperTickInfo.feeGrowthOutside1),
		);
	}
	const feeGrowthInside0 = subQ96(
		subQ96(bytesToQ96(poolInfo.feeGrowthGlobal0), feeGrowthBelow0),
		feeGrowthAbove0,
	);
	const feeGrowthInside1 = subQ96(
		subQ96(bytesToQ96(poolInfo.feeGrowthGlobal1), feeGrowthBelow1),
		feeGrowthAbove1,
	);

	return [feeGrowthInside0, feeGrowthInside1];
};

export const getLiquidityForAmounts = (
	currentSqrtPrice: Q96,
	lowerTickSqrtPrice: Q96,
	upperTickSqrtPrice: Q96,
	amount0: bigint,
	amount1: bigint,
): bigint => {
	if (lowerTickSqrtPrice > upperTickSqrtPrice) {
		throw new Error();
	}
	let liquidity: bigint;

	if (currentSqrtPrice <= lowerTickSqrtPrice) {
		liquidity = getLiquidityForAmount0(lowerTickSqrtPrice, upperTickSqrtPrice, amount0);
	} else if (currentSqrtPrice < upperTickSqrtPrice) {
		const liquidity0 = getLiquidityForAmount0(currentSqrtPrice, upperTickSqrtPrice, amount0);
		const liquidity1 = getLiquidityForAmount1(lowerTickSqrtPrice, currentSqrtPrice, amount1);

		if (liquidity0 < liquidity1) {
			liquidity = liquidity0;
		} else {
			liquidity = liquidity1;
		}
	} else {
		liquidity = getLiquidityForAmount1(lowerTickSqrtPrice, upperTickSqrtPrice, amount1);
	}
	if (liquidity < 0 || liquidity >= 2 ** 64) {
		throw new Error();
	}
	return liquidity;
};

export const getLiquidityForAmount0 = (
	lowerSqrtPrice: Q96,
	upperSqrtPrice: Q96,
	amount0: bigint,
): bigint => {
	const intermediate = mulDivQ96(lowerSqrtPrice, upperSqrtPrice, numberToQ96(BigInt(1)));
	const result = mulDivQ96(
		numberToQ96(amount0),
		intermediate,
		subQ96(upperSqrtPrice, lowerSqrtPrice),
	);
	return roundDownQ96(result);
};

export const getLiquidityForAmount1 = (
	lowerSqrtPrice: Q96,
	upperSqrtPrice: Q96,
	amount1: bigint,
): bigint => {
	const result = mulDivQ96(
		numberToQ96(amount1),
		numberToQ96(BigInt(1)),
		subQ96(upperSqrtPrice, lowerSqrtPrice),
	);
	return roundDownQ96(result);
};

export const getNewPositionID = (
	dexGlobalStoreData: DexGlobalStoreData,
	poolID: PoolID,
): Buffer => {
	const positionIndex = dexGlobalStoreData.positionCounter;
	// eslint-disable-next-line no-param-reassign
	dexGlobalStoreData.positionCounter += BigInt(1);
	return Buffer.concat([poolID, Buffer.from(positionIndex.valueOf().toLocaleString())]);
};

export const getOwnerAddressOfPosition = async (
	methodContext: MethodContext,
	positionsStore,
	positionID: PositionID,
): Promise<Buffer> => {
	const position = await positionsStore.get(methodContext, positionID);
	// eslint-disable-next-line @typescript-eslint/no-unsafe-return
	return position.ownerAddress;
};

export const getPoolIDFromPositionID = (positionID: PositionID): Buffer =>
	positionID.slice(0, NUM_BYTES_POOL_ID);

export const updatePosition = async (
	methodContext: MethodContext,
	events: NamedRegistry,
	stores: NamedRegistry,
	tokenMethod,
	positionID: PositionID,
	liquidityDelta: bigint,
): Promise<[bigint, bigint]> => {
	const poolsStore = stores.get(PoolsStore);
	const positionsStore = stores.get(PositionsStore);
	const priceTicksStore = stores.get(PriceTicksStore);
	const positionInfo = await positionsStore.get(methodContext, positionID);
	let amount0: bigint;
	let amount1: bigint;
	if (-liquidityDelta > positionInfo.liquidity) {
		const senderAddress = await getOwnerAddressOfPosition(
			methodContext,
			positionsStore,
			positionID,
		);

		events.get(PositionUpdateFailedEvent).add(
			methodContext,
			{
				senderAddress,
				positionID,
				result: POSITION_UPDATE_FAILED_INSUFFICIENT_LIQUIDITY,
			},
			[senderAddress, positionID],
			true,
		);
		throw new Error();
	}

	await collectFeesAndIncentives(events, stores, tokenMethod, methodContext, positionID);

	if (liquidityDelta === BigInt(0)) {
		amount0 = BigInt(0);
		amount1 = BigInt(0);
		return [amount0, amount1];
	}

	const poolID = getPoolIDFromPositionID(positionID);
	const poolInfo = await poolsStore.get(methodContext, poolID);
	const lowerTickInfo = await priceTicksStore.getKey(methodContext, [
		poolID,
		tickToBytes(positionInfo.tickLower),
	]);
	const upperTickInfo = await priceTicksStore.getKey(methodContext, [
		poolID,
		tickToBytes(positionInfo.tickUpper),
	]);
	const sqrtPriceLow = tickToPrice(positionInfo.tickLower);
	const sqrtPriceUp = tickToPrice(positionInfo.tickUpper);

	const roundUp = liquidityDelta > 0;
	const sqrtPrice = bytesToQ96(poolInfo.sqrtPrice);

	if (sqrtPrice <= sqrtPriceLow) {
		amount0 = getAmount0Delta(sqrtPriceLow, sqrtPriceUp, abs(liquidityDelta), roundUp);
		amount1 = BigInt(0);
	} else if (sqrtPriceLow < sqrtPrice && sqrtPrice < sqrtPriceUp) {
		amount0 = getAmount0Delta(sqrtPrice, sqrtPriceUp, abs(liquidityDelta), roundUp);
		amount1 = getAmount1Delta(sqrtPriceLow, sqrtPrice, abs(liquidityDelta), roundUp);
	} else {
		amount0 = BigInt(0);
		amount1 = getAmount1Delta(sqrtPriceLow, sqrtPriceUp, abs(liquidityDelta), roundUp);
	}

	const ownerAddress = await getOwnerAddressOfPosition(methodContext, positionsStore, positionID);
	if (liquidityDelta > 0) {
		await transferToPool(
			tokenMethod,
			methodContext,
			ownerAddress,
			poolID,
			getToken0Id(poolID),
			amount0,
		);
		await transferToPool(
			tokenMethod,
			methodContext,
			ownerAddress,
			poolID,
			getToken1Id(poolID),
			amount1,
		);
	} else {
		await transferFromPool(
			tokenMethod,
			methodContext,
			poolID,
			ownerAddress,
			getToken0Id(poolID),
			amount0,
		);
		await transferFromPool(
			tokenMethod,
			methodContext,
			poolID,
			ownerAddress,
			getToken1Id(poolID),
			amount1,
		);
	}

	if (sqrtPriceLow <= sqrtPrice && sqrtPrice < sqrtPriceUp) {
		poolInfo.liquidity += liquidityDelta;
		await poolsStore.set(methodContext, poolID, poolInfo);
	}

	positionInfo.liquidity += liquidityDelta;
	if (positionInfo.liquidity === BigInt(0)) {
		await positionsStore.del(methodContext, positionID);
	} else {
		await positionsStore.set(methodContext, positionID, positionInfo);
	}

	lowerTickInfo.liquidityNet += liquidityDelta;
	upperTickInfo.liquidityNet -= liquidityDelta;
	lowerTickInfo.liquidityGross += liquidityDelta;
	upperTickInfo.liquidityGross += liquidityDelta;

	if (lowerTickInfo.liquidityGross === BigInt(0)) {
		await priceTicksStore.delKey(methodContext, [
			poolID,
			q96ToBytes(tickToPrice(positionInfo.tickLower)),
		]);
	} else {
		await priceTicksStore.setKey(
			methodContext,
			[poolID, q96ToBytes(tickToPrice(positionInfo.tickLower))],
			lowerTickInfo,
		);
	}

	if (upperTickInfo.liquidityGross === BigInt(0)) {
		await priceTicksStore.delKey(methodContext, [
			poolID,
			q96ToBytes(tickToPrice(positionInfo.tickUpper)),
		]);
	} else {
		await priceTicksStore.setKey(
			methodContext,
			[poolID, q96ToBytes(tickToPrice(positionInfo.tickUpper))],
			upperTickInfo,
		);
	}

	return [amount0, amount1];
};

export const getProtocolSettings = async (methodContext: MethodContext, stores: NamedRegistry) => {
	const dexGlobalStoreData = await getDexGlobalData(methodContext, stores);
	return dexGlobalStoreData;
};

export const getToken0Amount = async (
	tokenMethod: TokenMethod,
	methodContext: MethodContext,
	poolId: PoolID,
): Promise<bigint> => {
	const address = poolIdToAddress(poolId);
	const tokenId = getToken0Id(poolId);
	return tokenMethod.getLockedAmount(methodContext, address, tokenId, MODULE_ID_DEX.toString());
};

export const getToken1Amount = async (
	tokenMethod: TokenMethod,
	methodContext: MethodContext,
	poolId: PoolID,
): Promise<bigint> => {
	const address = poolIdToAddress(poolId);
	const tokenId = getToken1Id(poolId);
	return tokenMethod.getLockedAmount(methodContext, address, tokenId, MODULE_ID_DEX.toString());
};

export const getAllTicks = async (
	methodContext: MethodContext,
	stores: NamedRegistry,
): Promise<TickID[]> => {
	const tickIds: Buffer[] = [];
	const priceTicksStore = stores.get(PriceTicksStore);
	const allTickIds = await priceTicksStore.getAll(methodContext);
	allTickIds.forEach(tickId => {
		tickIds.push(tickId.key);
	});
	return tickIds;
};

export const computeCurrentPrice = async (
	methodContext: MethodContext,
	stores: NamedRegistry,
	tokenIn: TokenID,
	tokenOut: TokenID,
	swapRoute: PoolID[],
): Promise<bigint> => {
	let price = BigInt(1);
	let tokenInPool = tokenIn;
	// eslint-disable-next-line @typescript-eslint/no-misused-promises
	for (const poolId of swapRoute) {
		const pool = await getPool(methodContext, stores, poolId);
		if ((await getPool(methodContext, stores, poolId)) == null) {
			throw new Error('Not a valid pool');
		}
		if (tokenInPool.equals(getToken0Id(poolId))) {
			price = mulQ96(price, bytesToQ96(pool.sqrtPrice));
			tokenInPool = getToken1Id(poolId);
		} else if (tokenInPool.equals(getToken1Id(poolId))) {
			price = mulQ96(price, invQ96(bytesToQ96(pool.sqrtPrice)));
			tokenInPool = getToken0Id(poolId);
		} else {
			throw new Error('Incorrect swap path for price computation');
		}
	}

	if (!tokenInPool.equals(tokenOut)) {
		throw new Error('Incorrect swap path for price computation');
	}
	return mulQ96(price, price);
};

export const getAdjacent = async (
	methodContext,
	stores: NamedRegistry,
	vertex: TokenID,
): Promise<AdjacentEdgesInterface[]> => {
	const result: AdjacentEdgesInterface[] = [];
	const poolIDs = await getAllPoolIDs(methodContext, stores.get(PoolsStore));
	poolIDs.forEach(edge => {
		if (getToken0Id(edge).equals(vertex)) {
			result.push({ edge, vertex: getToken1Id(edge) });
		} else if (getToken1Id(edge).equals(vertex)) {
			result.push({ edge, vertex: getToken0Id(edge) });
		}
	});
	return result;
};

export const computeRegularRoute = async (
	methodContext: ModuleEndpointContext,
	stores: NamedRegistry,
	tokenIn: TokenID,
	tokenOut: TokenID,
): Promise<TokenID[]> => {
	let lskAdjacent = await getAdjacent(methodContext, stores, TOKEN_ID_LSK);
	let tokenInFlag = false;
	let tokenOutFlag = false;

	lskAdjacent.forEach(lskAdjacentEdge => {
		if (lskAdjacentEdge.edge.equals(tokenIn)) {
			tokenInFlag = true;
		}
		if (lskAdjacentEdge.edge.equals(tokenOut)) {
			tokenOutFlag = true;
		}
	});

	if (tokenInFlag && tokenOutFlag) {
		return [tokenIn, TOKEN_ID_LSK, tokenOut];
	}

	tokenOutFlag = false;
	lskAdjacent = await getAdjacent(methodContext, stores, tokenIn);

	lskAdjacent.forEach(lskAdjacentEdge => {
		if (lskAdjacentEdge.edge.equals(tokenOut)) {
			tokenOutFlag = true;
		}
	});

	if (tokenOutFlag) {
		return [tokenIn, tokenOut];
	}
	return [];
};

export const getAllPoolIDs = async (
	methodContext: MethodContext,
	poolStore: PoolsStore,
): Promise<PoolID[]> => {
	const poolIds: PoolID[] = [];
	const allPoolIds = await poolStore.getAll(methodContext);
	if (allPoolIds != null && allPoolIds.length > 0) {
		allPoolIds.forEach(poolId => {
			poolIds.push(poolId.key);
		});
	}
	return poolIds;
};

export const computeExceptionalRoute = async (
	methodContext: ModuleEndpointContext,
	stores: NamedRegistry,
	tokenIn: TokenID,
	tokenOut: TokenID,
): Promise<TokenID[]> => {
	const routes: routeInterface[] = [
		{
			path: [],
			endVertex: tokenIn,
		},
	];
	const visited = [tokenIn];
	while (routes.length > 0) {
		const routeElement = routes.shift();
		if (routeElement != null) {
			if (routeElement.endVertex.equals(tokenOut)) {
				routeElement.path.push(tokenOut);
				return routeElement.path;
			}
			const adjacent = await getAdjacent(methodContext, stores, routeElement.endVertex);
			adjacent.forEach(adjacentEdge => {
				if (visited.includes(adjacentEdge.vertex)) {
					if (routeElement != null) {
						routeElement.path.push(adjacentEdge.edge);
						routes.push({ path: routeElement.path, endVertex: adjacentEdge.vertex });
						visited.push(adjacentEdge.vertex);
					}
				}
			});
		}
	}
	return [];
};

export const getCredibleDirectPrice = async (
	tokenMethod: TokenMethod,
	methodContext: ModuleEndpointContext,
	stores: NamedRegistry,
	tokenID0: TokenID,
	tokenID1: TokenID,
): Promise<bigint> => {
	const directPools: Buffer[] = [];
	const dexModule = new DexModule();
	const endpoint = new DexEndpoint(stores, dexModule.offchainStores);
	const settings = (await endpoint.getDexGlobalData(methodContext)).poolCreationSettings;
	const allpoolIDs = await endpoint.getAllPoolIDs(methodContext);

	const tokenIDArrays = [tokenID0, tokenID1];
	// eslint-disable-next-line @typescript-eslint/require-array-sort-compare, no-param-reassign
	[tokenID0, tokenID1] = tokenIDArrays.sort();
	const concatedTokenIDs = Buffer.concat([tokenID0, tokenID1]);

	settings.forEach(setting => {
		const result = Buffer.alloc(4);
		const tokenIDAndSettingsArray = [
			concatedTokenIDs,
			q96ToBytes(BigInt(result.writeUInt32BE(setting.feeTier, 0))),
		];
		const potentialPoolId: Buffer = Buffer.concat(tokenIDAndSettingsArray);
		allpoolIDs.forEach(poolId => {
			if (poolId.equals(potentialPoolId)) {
				directPools.push(potentialPoolId);
			}
		});
	});

	if (directPools.length === 0) {
		throw new Error('No direct pool between given tokens');
	}

	const token1ValuesLocked: bigint[] = [];

	for (const directPool of directPools) {
		const pool = await endpoint.getPool(methodContext, directPool);
		const token0Amount = await endpoint.getToken0Amount(tokenMethod, methodContext, directPool);
		const token0ValueQ96 = mulQ96(
			mulQ96(numberToQ96(token0Amount), bytesToQ96(pool.sqrtPrice)),
			bytesToQ96(pool.sqrtPrice),
		);
		token1ValuesLocked.push(
			roundDownQ96(token0ValueQ96) +
				(await endpoint.getToken1Amount(tokenMethod, methodContext, directPool)),
		);
	}

	let minToken1ValueLocked = BigInt(MAX_SINT32);
	let minToken1ValueLockedIndex = 0;
	token1ValuesLocked.forEach((token1ValueLocked, index) => {
		if (token1ValueLocked > minToken1ValueLocked) {
			minToken1ValueLocked = token1ValueLocked;
			minToken1ValueLockedIndex = index;
		}
	});

	const poolSqrtPrice = (
		await endpoint.getPool(methodContext, directPools[minToken1ValueLockedIndex])
	).sqrtPrice;
	return mulQ96(bytesToQ96(poolSqrtPrice), bytesToQ96(poolSqrtPrice));
};

export const swapWithin = (
	sqrtCurrentPrice: bigint,
	sqrtTargetPrice: bigint,
	liquidity: bigint,
	amountRemaining: bigint,
	exactInput: boolean,
): [bigint, bigint, bigint] => {
	const zeroToOne: boolean = sqrtCurrentPrice >= sqrtTargetPrice;
	let amountIn = BigInt(0);
	let amountOut = BigInt(0);
	let sqrtUpdatedPrice: bigint;
	if (exactInput) {
		if (zeroToOne) {
			amountIn = getAmount0Delta(sqrtCurrentPrice, sqrtTargetPrice, liquidity, true);
		} else {
			amountIn = getAmount1Delta(sqrtCurrentPrice, sqrtTargetPrice, liquidity, true);
		}
	} else if (zeroToOne) {
		amountOut = getAmount1Delta(sqrtCurrentPrice, sqrtTargetPrice, liquidity, false);
	} else {
		amountOut = getAmount0Delta(sqrtCurrentPrice, sqrtTargetPrice, liquidity, false);
	}
	if (
		(exactInput && amountRemaining >= amountIn) ||
		(!exactInput && amountRemaining >= amountOut)
	) {
		sqrtUpdatedPrice = sqrtTargetPrice;
	} else {
		sqrtUpdatedPrice = computeNextPrice(
			sqrtCurrentPrice,
			liquidity,
			amountRemaining,
			zeroToOne,
			exactInput,
		);
	}
	if (zeroToOne) {
		amountIn = getAmount0Delta(sqrtCurrentPrice, sqrtUpdatedPrice, liquidity, true);
		amountOut = getAmount1Delta(sqrtCurrentPrice, sqrtUpdatedPrice, liquidity, false);
	} else {
		amountIn = getAmount1Delta(sqrtCurrentPrice, sqrtUpdatedPrice, liquidity, true);
		amountOut = getAmount0Delta(sqrtCurrentPrice, sqrtUpdatedPrice, liquidity, false);
	}
	return [sqrtUpdatedPrice, amountIn, amountOut];
};

export const crossTick = async (
	methodContext: MethodContext,
	stores: NamedRegistry,
	tickId: TickID,
	leftToRight: boolean,
	currentHeight: number,
) => {
	const poolId = tickId.slice(0, NUM_BYTES_POOL_ID);
	await updatePoolIncentives(methodContext, stores, poolId, currentHeight);
	const poolStoreData = await getPool(methodContext, stores, poolId);
	const dexModule = new DexModule();
	const endpoint = new DexEndpoint(stores, dexModule.offchainStores);
	const priceTickStoreData = await endpoint.getTickWithTickId(methodContext, [tickId]);
	if (leftToRight) {
		poolStoreData.liquidity += priceTickStoreData.liquidityNet;
	} else {
		poolStoreData.liquidity -= priceTickStoreData.liquidityNet;
	}
	const feeGrowthGlobal0Q96 = bytesToQ96(poolStoreData.feeGrowthGlobal0);
	const feeGrowthOutside0Q96 = bytesToQ96(priceTickStoreData.feeGrowthOutside0);
	priceTickStoreData.feeGrowthOutside0 = q96ToBytes(
		subQ96(feeGrowthGlobal0Q96, feeGrowthOutside0Q96),
	);
	const feeGrowthGlobal1Q96 = bytesToQ96(poolStoreData.feeGrowthGlobal1);
	const feeGrowthOutside1Q96 = bytesToQ96(priceTickStoreData.feeGrowthOutside1);
	priceTickStoreData.feeGrowthOutside1 = q96ToBytes(
		subQ96(feeGrowthGlobal1Q96, feeGrowthOutside1Q96),
	);
	const incentivesAccumulatorQ96 = bytesToQ96(poolStoreData.incentivesPerLiquidityAccumulator);
	const incentivesOutsideQ96 = bytesToQ96(priceTickStoreData.incentivesPerLiquidityOutside);
	priceTickStoreData.incentivesPerLiquidityOutside = q96ToBytes(
		subQ96(incentivesAccumulatorQ96, incentivesOutsideQ96),
	);
};

export const getAllTokenIDs = async (
	methodContext: MethodContext,
	stores: NamedRegistry,
): Promise<Set<TokenID>> => {
	const tokens = new Set<TokenID>();
	const allPoolIds = await getAllPoolIDs(methodContext, stores.get(PoolsStore));

	if (allPoolIds != null && allPoolIds.length > 0) {
		allPoolIds.forEach(poolID => {
			tokens.add(getToken0Id(poolID));
			tokens.add(getToken1Id(poolID));
		});
	}

	return tokens;
};

export const getAllPositionIDsInPool = (
	poolId: PoolID,
	positionIdsList: PositionID[],
): Buffer[] => {
	const result: Buffer[] = [];
	positionIdsList.forEach(positionId => {
		if (getPoolIDFromPositionID(positionId).equals(poolId)) {
			result.push(positionId);
		}
	});
	return result;
};

export const getPool = async (
	methodContext,
	stores: NamedRegistry,
	poolID: PoolID,
): Promise<PoolsStoreData> => {
	const poolsStore = stores.get(PoolsStore);
	const poolStoreData = await poolsStore.getKey(methodContext, [poolID]);
	return poolStoreData;
};

export const getDexGlobalData = async (
	methodContext: MethodContext,
	stores: NamedRegistry,
): Promise<DexGlobalStoreData> => {
	const dexGlobalStore = stores.get(DexGlobalStore);
	return dexGlobalStore.get(methodContext, Buffer.from([]));
};

export const getPosition = async (
	methodContext: MethodContext,
	stores: NamedRegistry,
	positionID: PositionID,
	positionIdsList: PositionID[],
): Promise<PositionsStoreData> => {
	if (positionIdsList.includes(positionID)) {
		throw new Error();
	}
	const positionsStore = stores.get(PositionsStore);
	const positionStoreData = await positionsStore.get(methodContext, positionID);
	return positionStoreData;
};

export const getTickWithPoolIdAndTickValue = async (
	methodContext: MethodContext,
	stores: NamedRegistry,
	poolId: PoolID,
	tickValue: number,
): Promise<PriceTicksStoreData> => {
	const priceTicksStore = stores.get(PriceTicksStore);
	const key = poolId.toLocaleString() + tickToBytes(tickValue).toLocaleString();
	const priceTicksStoreData = await priceTicksStore.get(methodContext, Buffer.from(key, 'hex'));
	if (priceTicksStoreData == null) {
		throw new Error('No tick with the specified poolId and tickValue');
	} else {
		return priceTicksStoreData;
	}
};

export const computeTokenGenesisAsset = (tokenDistribution: TokenDistribution) => {
	// initialize account with address ADDRESS_LIQUIDITY_PROVIDER_INCENTIVES
	let accountIndex = tokenDistribution.accounts.findIndex(
		el => el.address === ADDRESS_LIQUIDITY_PROVIDER_INCENTIVES,
	);
	if (accountIndex === -1) {
		tokenDistribution.accounts.push({
			address: ADDRESS_LIQUIDITY_PROVIDER_INCENTIVES,
			balance: BigInt(0),
		});
	} else {
		// eslint-disable-next-line no-param-reassign
		tokenDistribution.accounts[accountIndex].balance = BigInt(0);
	}

	accountIndex = tokenDistribution.accounts.findIndex(
		el => el.address === ADDRESS_VALIDATOR_INCENTIVES,
	);
	if (accountIndex === -1) {
		tokenDistribution.accounts.push({
			address: ADDRESS_VALIDATOR_INCENTIVES,
			balance: BigInt(0),
		});
	} else {
		// eslint-disable-next-line no-param-reassign
		tokenDistribution.accounts[accountIndex].balance = BigInt(0);
	}

	const tokenModuleAsset: GenesisTokenStore = {
		userSubstore: [],
		supplySubstore: [],
		escrowSubstore: [],
		supportedTokensSubstore: [],
	};
	let totalSupply = BigInt(0);

	for (const account of tokenDistribution.accounts) {
		tokenModuleAsset.userSubstore.push({
			address: account.address,
			tokenID: TOKEN_ID_DEX,
			availableBalance: account.balance,
			lockedBalances: [],
		});
		totalSupply += account.balance;
	}
	tokenModuleAsset.userSubstore.sort((a, b) => a.address.compare(b.address));

	tokenModuleAsset.supplySubstore.push({
		tokenID: TOKEN_ID_DEX,
		totalSupply,
	});

	tokenModuleAsset.supportedTokensSubstore.push({
		chainID: ALL_SUPPORTED_TOKENS_KEY,
		supportedTokenIDs: [],
	});

	const data = codec.encode(genesisTokenStoreSchema, tokenModuleAsset);
	return {
		module: MODULE_NAME_TOKEN,
		data,
	};
};
