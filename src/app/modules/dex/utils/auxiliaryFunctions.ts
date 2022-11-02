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

import { MethodContext, TokenMethod } from 'lisk-sdk';

import { utils } from '@liskhq/lisk-cryptography';

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
	NUM_BYTES_POSITION_ID,
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
} from '../constants';

import { uint32beInv } from './bigEndian';

import { PoolID, PositionID, Address, TokenID, Q96 } from '../types';

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

const abs = (x: bigint) => (x < BigInt(0) ? -x : x);

export const poolIdToAddress = (poolId: PoolID): Address => {
	const _address: Buffer = utils.hash(poolId);
	return _address.slice(0, NUM_BYTES_ADDRESS);
};

export const getToken0Id = (poolId: PoolID): TokenID => poolId.slice(0, NUM_BYTES_TOKEN_ID);

export const getToken1Id = (poolId: PoolID): TokenID =>
	poolId.slice(NUM_BYTES_TOKEN_ID, 2 * NUM_BYTES_TOKEN_ID);

export const getFeeTier = (poolId: PoolID): number => {
	const _buffer: Buffer = poolId.slice(-4);
	const _hexBuffer: string = _buffer.toString('hex');

	return uint32beInv(_hexBuffer);
};

export const getPositionIndex = (positionId: PositionID): number => {
	const _buffer: Buffer = positionId.slice(2 * NUM_BYTES_POSITION_ID, NUM_BYTES_ADDRESS);
	const _hexBuffer: string = _buffer.toString('hex');

	return uint32beInv(_hexBuffer);
};

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
	const { protocolFeeAddress } = await settings.get(methodContext, Buffer.from([]));
	await tokenMethod.transfer(methodContext, senderAddress, protocolFeeAddress, tokenId, amount);
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
<<<<<<< HEAD
	if (!senderAddress.equals(await getOwnerAddressOfPositionWithMethodContext(positionsStore, positionID,methodContext))) {
		events.get(PositionUpdateFailedEvent).log(methodContext, {
			senderAddress,
			positionID,
			result: POSITION_UPDATE_FAILED_NOT_OWNER,
		});
=======
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
>>>>>>> 82e1f2e (Fix auxiliary and math functions, improve code)
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
<<<<<<< HEAD
	const ownerAddress = await getOwnerAddressOfPositionWithMethodContext(positionsStore, positionID,methodContext);
=======
	const ownerAddress = await getOwnerAddressOfPosition(methodContext, positionsStore, positionID);
>>>>>>> 82e1f2e (Fix auxiliary and math functions, improve code)
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
		TokenMethod,
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
<<<<<<< HEAD

	const dexGlobalStoreData = await dexGlobalStore.get(tokenMethod, Buffer.from([]));
=======
	const dexGlobalStoreData = await dexGlobalStore.get(methodContext, Buffer.from([]));
>>>>>>> 82e1f2e (Fix auxiliary and math functions, improve code)
	dexGlobalStoreData.collectableLSKFees -= collectableFeesLSK;
	await dexGlobalStore.set(methodContext, Buffer.from([]), dexGlobalStoreData);

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

export const computeCollectableFees = async (positionStore, positionID: PositionID): Promise<[bigint, bigint, Q96, Q96]> => {
	const positionInfo = positionStore(positionID)
	const poolID = getPoolIDFromPositionID(positionID)
	const [feeGrowthInside0, feeGrowthInside1] = getFeeGrowthInside(positionID)

	const collectableFees0 = roundDownQ96(mulQ96(subQ96(feeGrowthInside0, positionInfo.feeGrowthInsideLast0), positionInfo.liquidity))
	const collectableFees1 = roundDownQ96(mulQ96(subQ96(feeGrowthInside1, positionInfo.feeGrowthInsideLast1), positionInfo.liquidity))
	return [collectableFees0, collectableFees1, feeGrowthInside0, feeGrowthInside1];
};

<<<<<<< HEAD

export const computeCollectableIncentives = async (dexGlobalState, tokenAPI, positionID: PositionID, collectableFees0: number, collectableFees1: number): Promise<[number, number]> => {
	const poolID = getPoolIDFromPositionID(positionID)
	let collectableFeesLSK = 0
	if (getToken0Id(poolID) == TOKEN_ID_LSK) {
		collectableFeesLSK = collectableFees0
	} else if (getToken1Id(poolID) == TOKEN_ID_LSK) {
		collectableFeesLSK = collectableFees1
=======
export const computeCollectableIncentives = async (
	dexGlobalStore,
	tokenMethod,
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
>>>>>>> ce6e365 (Fix auxiliary, q96 and stores)
	}

	if (collectableFeesLSK == 0) {
		return [0, 0]
	}

<<<<<<< HEAD
	const totalCollectableLSKFees = dexGlobalState.collectableLSKFees
	const availableLPIncentives = tokenAPI.getAvailableBalance(ADDRESS_LIQUIDITY_PROVIDERS_REWARDS_POOL, TOKEN_ID_REWARDS)
	const incentivesForPosition = (availableLPIncentives * collectableFeesLSK) / totalCollectableLSKFees
	return [collectableFeesLSK, incentivesForPosition]
}
=======
	const totalCollectableLSKFees = dexGlobalStore.collectableLSKFees;
	const availableLPIncentives = await tokenMethod.getAvailableBalance(
		ADDRESS_LIQUIDITY_PROVIDERS_REWARDS_POOL,
		TOKEN_ID_REWARDS,
	);
	await console.log(availableLPIncentives);
	const incentivesForPosition =
		(availableLPIncentives * collectableFeesLSK) / totalCollectableLSKFees;
	return [collectableFeesLSK, incentivesForPosition];
};
>>>>>>> fce1422 (added the unit test for auxiliary functions)

export const computePoolID = async (tokenID0: TokenID, tokenID1: TokenID, feeTier: number): Promise<Buffer> => {
	const feeTierBuffer = Buffer.alloc(4);
	feeTierBuffer.writeInt8(feeTier, 0);
	return Buffer.concat([tokenID0, tokenID1, feeTierBuffer]);
}

export const createPool = async (settings, apiContext, poolsStore, tokenID0: TokenID, tokenID1: TokenID, feeTier: number, initialSqrtPrice: Q96): Promise<number> => {
	const poolSetting = settings.poolCreationSettings.find(s => s.feeTier == feeTier)

	if (!poolSetting) {
		return POOL_CREATION_FAILED_INVALID_FEE_TIER;
	}

	const poolID = computePoolID(tokenID0, tokenID1, feeTier)
	if (poolsStore.getKey(poolID)) {
		return POOL_CREATION_FAILED_ALREADY_EXISTS
	}

	const poolStoreValue = {
		"liquidity": 0,
		"sqrtPrice": initialSqrtPrice,
		"feeGrowthGlobal0": numberToQ96(BigInt(0)),
		"feeGrowthGlobal1": numberToQ96(BigInt(0)),
		"protocolFees0": numberToQ96(BigInt(0)),
		"protocolFees1": numberToQ96(BigInt(0)),
		"tickSpacing": poolSetting.tickSpacing
	}
	poolsStore.set(apiContext, poolID, poolStoreValue);
	return POOL_CREATION_SUCCESS
}

export const createPosition(apiContext, poolsStore, priceTicksStore, priceTickSchema, positionsStore, positionSchema, senderAddress: Address, poolID: PoolID, tickLower: number, tickUpper: number): [number, PositionID] => {
	if (!poolsStore.getKey(senderAddress, poolID)) {
		return [POSITION_CREATION_FAILED_NO_POOL, Buffer.from([])]
	}
	const currentPool = poolsStore.getKey(senderAddress, poolID)

	if (MIN_TICK > tickLower || tickLower >= tickUpper || tickUpper > MAX_TICK) {
		return [POSITION_CREATION_FAILED_INVALID_TICKS, Buffer.from([])];
	}

	if (tickLower % currentPool.tickSpacing != 0 || tickUpper % currentPool.tickSpacing != 0) {
		return [POSITION_CREATION_FAILED_INVALID_TICK_SPACING, Buffer.from([])]
	}

	if (!priceTicksStore.getKey(poolID, tickLower)) {
		const tickStoreValue = {
			"liquidityNet": 0,
			"liquidityGross": 0,
			"feeGrowthOutside0": numberToQ96(BigInt(0)),
			"feeGrowthOutside1": numberToQ96(BigInt(0))
		}
		if (currentPool.sqrtPrice >= tickToPrice(tickLower)) {
			tickStoreValue.feeGrowthOutside0 = currentPool.feeGrowthGlobal0
			tickStoreValue.feeGrowthOutside1 = currentPool.feeGrowthGlobal1
		}

		priceTicksStore.set(poolID, tickLower, codec.encode(priceTickSchema, tickStoreValue));
	}

	if (!priceTicksStore.getKey(poolID, tickUpper)) {
		const tickStoreValue = {
			"liquidityNet": 0,
			"liquidityGross": 0,
			"feeGrowthOutside0": numberToQ96(BigInt(0)),
			"feeGrowthOutside1": numberToQ96(BigInt(0))
		}
		if (currentPool.sqrtPrice >= tickToPrice(tickUpper)) {
			tickStoreValue.feeGrowthOutside0 = currentPool.feeGrowthGlobal0
			tickStoreValue.feeGrowthOutside1 = currentPool.feeGrowthGlobal1
		}

		priceTicksStore.set(poolID, tickUpper, codec.encode(priceTickSchema, tickStoreValue));
	}

<<<<<<< HEAD
	const positionID = await getNewPositionID(poolID, senderAddress)
=======
	const dexGlobalStoreData = await dexGlobalStore.get(methodContext, Buffer.from([]));
>>>>>>> fce1422 (added the unit test for auxiliary functions)

	const positionID = getNewPositionID(dexGlobalStoreData, poolID);
	const positionValue = {
<<<<<<< HEAD
		"tickLower": tickLower,
		"tickUpper": tickUpper,
		"liquidity": 0,
		"feeGrowthInsideLast0": numberToQ96(BigInt(0)),
		"feeGrowthInsideLast1": numberToQ96(BigInt(0)),
		"ownerAddress": senderAddress
	}
	positionsStore.set(positionID, codec.encode(positionSchema, positionValue))
	return [POSITION_CREATION_SUCCESS, positionID]
}
=======
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
>>>>>>> 82e1f2e (Fix auxiliary and math functions, improve code)

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

<<<<<<< HEAD
export const getNewPositionID = async (dexGlobalState, poolID: PoolID, ownerAddress: Address): Promise<Buffer> => {
	const positionIndex = dexGlobalState.positionCounter
	dexGlobalState.positionCounter = dexGlobalState.positionCounter + 1

	return Buffer.concat([poolID, Buffer.from(positionIndex)])
}
=======
export const getNewPositionID = (dexGlobalStoreData, poolID: PoolID): Buffer => {
	const positionIndex:BigInt = dexGlobalStoreData.positionCounter;
	// eslint-disable-next-line no-param-reassign
	dexGlobalStoreData.positionCounter++;
	return Buffer.concat([poolID, Buffer.from(positionIndex.toString())]);
};
>>>>>>> fce1422 (added the unit test for auxiliary functions)

export const getOwnerAddressOfPosition = async (
	methodContext: MethodContext,
	positionsStore,
	positionID: PositionID,
): Promise<Buffer> => {
	const position = await positionsStore.get(methodContext, positionID);
	// eslint-disable-next-line @typescript-eslint/no-unsafe-return
	return position.ownerAddress;
};

export const getOwnerAddressOfPositionWithMethodContext = async (
	positionsStore,
	positionID: PositionID,
	methodContext:MethodContext
): Promise<Buffer> => {
	const position = await positionsStore.get(methodContext,positionID);
	// eslint-disable-next-line @typescript-eslint/no-unsafe-return
	return position.ownerAddress;
};


export const getPoolIDFromPositionID = (positionID: PositionID): Buffer =>
	positionID.slice(-NUM_BYTES_POOL_ID);

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
		q96ToBytes(tickToPrice(positionInfo.tickLower)),
	]);
	const upperTickInfo = await priceTicksStore.getKey(methodContext, [
		poolID,
		q96ToBytes(tickToPrice(positionInfo.tickUpper)),
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

	if (sqrtPriceLow <= poolInfo.sqrtPrice && poolInfo.sqrtPrice < sqrtPriceUp) {
		poolInfo.liquidity += liquidityDelta
		poolsStore.set(poolID, poolInfo)
	}

	positionInfo.liquidity += liquidityDelta
	if (positionInfo.liquidity == 0) {
		positionsStore.delete(positionID)
	} else {
		positionsStore.set(positionID, positionInfo)
	}

	lowerTickInfo.liquidityNet += liquidityDelta
	upperTickInfo.liquidityNet -= liquidityDelta
	lowerTickInfo.liquidityGross += liquidityDelta
	upperTickInfo.liquidityGross += liquidityDelta

	if (lowerTickInfo.liquidityGross == 0) {
		priceTicksStore.delete(poolID, positionInfo.tickLower)
	} else {
		priceTicksStore.set(poolID, positionInfo.tickLower, lowerTickInfo)
	}

	if (upperTickInfo.liquidityGross == 0) {
		priceTicksStore.delete(poolID, positionInfo.tickUpper)
	} else {
		priceTicksStore.set(poolID, positionInfo.tickUpper, upperTickInfo)
	}

	return [amount0, amount1]
}




// Convert a hex string to a byte array
export const hexToBytes = (hex) => {
	const bytes: number[] = [];
	for (let c = 0; c < hex.length; c += 2)
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		bytes.push(parseInt(hex.substr(c, 2), 16));
	return bytes;
}
