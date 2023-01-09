/* eslint-disable import/no-cycle */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/*
 * Copyright © 2022 Lisk Foundation
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

import { MethodContext, TokenMethod, cryptography } from 'lisk-sdk';

import { NamedRegistry } from 'lisk-framework/dist-node/modules/named_registry';

import {
	DexGlobalStore,
	PoolsStore,
	PositionsStore,
	PriceTicksStore,
	SettingsStore,
} from '../stores';

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
	TOKEN_ID_REWARDS,
	ADDRESS_LIQUIDITY_PROVIDERS_REWARDS_POOL,
	MODULE_NAME_DEX,
} from '../constants';

import { PoolID, PositionID, Address, TokenID, Q96, routeInterface, AdjacentEdgesInterface } from '../types';

import {
	subQ96,
	mulQ96,
	mulDivQ96,
	numberToQ96,
	roundDownQ96,
	q96ToBytes,
	bytesToQ96,
} from './q96';

import { getAmount0Delta, getAmount1Delta, priceToTick, tickToPrice } from './math';
import { FeesIncentivesCollectedEvent, PositionUpdateFailedEvent } from '../events';
import { tickToBytes } from '../stores/priceTicksStore';
import { ADDRESS_VALIDATOR_REWARDS_POOL } from '../../dexRewards/constants';
import { DexGlobalStoreData } from '../stores/dexGlobalStore';
import { DexEndpoint } from '../endpoint';
import { DexModule } from '../module';
import { MAX_SINT32 } from '@liskhq/lisk-validator';

const { utils } = cryptography;

const abs = (x: bigint) => (x < BigInt(0) ? -x : x);

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

export const transferToProtocolFeeAccount = async (
	tokenMethod: TokenMethod,
	methodContext,
	settings: SettingsStore,
	senderAddress: Address,
	tokenId: TokenID,
	amount: bigint,
): Promise<void> => {
	const { protocolFeeAddress } = await settings.get(methodContext, Buffer.alloc(0));
	await tokenMethod.transfer(methodContext, senderAddress, protocolFeeAddress, tokenId, amount);
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
		ADDRESS_VALIDATOR_REWARDS_POOL,
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

	const [
		collectedFees0,
		collectedFees1,
		feeGrowthInside0,
		feeGrowthInside1,
	] = await computeCollectableFees(stores, methodContext, positionID);

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
	const [collectableFeesLSK, incentivesForPosition] = await computeCollectableIncentives(
		dexGlobalStore,
		tokenMethod,
		methodContext,
		positionID,
		collectedFees0,
		collectedFees1,
	);

	await tokenMethod.transfer(
		methodContext,
		ADDRESS_LIQUIDITY_PROVIDERS_REWARDS_POOL,
		ownerAddress,
		TOKEN_ID_REWARDS,
		incentivesForPosition,
	);
	const dexGlobalStoreData = await dexGlobalStore.get(methodContext, Buffer.alloc(0));
	dexGlobalStoreData.collectableLSKFees -= collectableFeesLSK;
	await dexGlobalStore.set(methodContext, Buffer.alloc(0), dexGlobalStoreData);

	events.get(FeesIncentivesCollectedEvent).log(methodContext, {
		senderAddress: ownerAddress,
		positionID,
		collectedFees0,
		tokenID0: getToken0Id(poolID),
		collectedFees1,
		tokenID1: getToken1Id(poolID),
		collectedIncentives: incentivesForPosition,
		tokenIDIncentives: TOKEN_ID_REWARDS,
	});
};

export const computeCollectableFees = async (
	stores: NamedRegistry,
	methodContext: MethodContext,
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
	const dexGlobalStoreData = await dexGlobalStore.get(methodContext, Buffer.from([]));
	const totalCollectableLSKFees = dexGlobalStoreData.collectableLSKFees;
	const availableLPIncentives = await tokenMethod.getAvailableBalance(
		methodContext,
		ADDRESS_LIQUIDITY_PROVIDERS_REWARDS_POOL,
		TOKEN_ID_REWARDS,
	);
	const incentivesForPosition =
		(availableLPIncentives * collectableFeesLSK) / totalCollectableLSKFees;
	return [collectableFeesLSK, incentivesForPosition];
};

export const computePoolID = (tokenID0: TokenID, tokenID1: TokenID, feeTier: number): Buffer => {
	const feeTierBuffer = Buffer.alloc(4);
	feeTierBuffer.writeInt8(feeTier, 0);
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
		heightIncentivesUpdate: 0,
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
	positionID.slice(-NUM_BYTES_POOL_ID, 14);

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

export const getAdjacent = async (
	methodContext: MethodContext,
	stores: NamedRegistry,
	vertex: TokenID,
): Promise<AdjacentEdgesInterface[]> => {
	const result: AdjacentEdgesInterface[] = [];
	const dexModule = new DexModule();
	const endpoint = new DexEndpoint(stores, dexModule.offchainStores);
	const poolIDs = await endpoint.getAllPoolIDs(methodContext, stores.get(PoolsStore));
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
	methodContext: MethodContext,
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


export const computeExceptionalRoute = async (
	methodContext: MethodContext,
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
			if (routeElement?.endVertex.equals(tokenOut)) {
				routeElement.path.push(tokenOut);
				return routeElement.path;
			}
			const adjacent = await getAdjacent(methodContext, stores, routeElement?.endVertex);
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
	methodContext: MethodContext,
	stores: NamedRegistry,
	tokenID0: TokenID,
	tokenID1: TokenID,
): Promise<bigint> => {
	const directPools: Buffer[] = [];
	const dexModule = new DexModule();
	const endpoint = new DexEndpoint(stores, dexModule.offchainStores);
	const settings = (await endpoint.getDexGlobalData(methodContext, stores)).poolCreationSettings;
	const allpoolIDs = await endpoint.getAllPoolIDs(methodContext, stores.get(PoolsStore));
	
	const tokenIDArrays = [tokenID0, tokenID1];
	[tokenID0,tokenID1] = tokenIDArrays.sort();
	const concatedTokenIDs = Buffer.concat([tokenID0,tokenID1]);

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
		console.log(allpoolIDs)
		throw new Error('No direct pool between given tokens');
	}

	const token1ValuesLocked: bigint[] = [];

	for (const directPool of directPools) {
		const pool = await endpoint.getPool(methodContext, stores, directPool);
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
		await endpoint.getPool(methodContext, stores, directPools[minToken1ValueLockedIndex])
	).sqrtPrice;
	return mulQ96(bytesToQ96(poolSqrtPrice), bytesToQ96(poolSqrtPrice));
};