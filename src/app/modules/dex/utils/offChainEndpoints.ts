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

import { MethodContext, TokenMethod } from 'lisk-sdk';
import { PoolsStore, PriceTicksStore } from '../stores';
import { PoolID, PositionID, Q96, TickID, TokenID } from '../types';
import {
	computeCollectableFees,
	computeCurrentPrice,
	computeExceptionalRoute,
	computeRegularRoute,
	getAllPoolIDs,
	getAllTicks,
	getCredibleDirectPrice,
	getPool,
	getPoolIDFromPositionID,
	getToken0Amount,
	getToken0Id,
	getToken1Amount,
	getToken1Id,
	swap,
} from './auxiliaryFunctions';
import { NamedRegistry } from 'lisk-framework/dist-node/modules/named_registry';
import { addQ96, bytesToQ96, divQ96, invQ96, mulQ96, roundDownQ96 } from './q96';
import { DexGlobalStore, DexGlobalStoreData } from '../stores/dexGlobalStore';
import {
	MAX_HOPS_SWAP,
	MAX_SQRT_RATIO,
	MIN_SQRT_RATIO,
	NUM_BYTES_POOL_ID,
	TOKEN_ID_LSK,
} from '../constants';
import { PositionsStore, PositionsStoreData } from '../stores/positionsStore';
import { PriceTicksStoreData, tickToBytes } from '../stores/priceTicksStore';

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

export const getAllTickIDsInPool = async (
	methodContext: MethodContext,
	stores: NamedRegistry,
	poolId: PoolID,
): Promise<TickID[]> => {
	const result: Buffer[] = [];
	const allTicks = await getAllTicks(methodContext, stores);
	allTicks.forEach(tickID => {
		if (getPoolIDFromTickID(tickID).equals(poolId)) {
			result.push(tickID);
		}
	});
	return result;
};

export const getCurrentSqrtPrice = async (
	methodContext: MethodContext,
	stores: NamedRegistry,
	poolID: PoolID,
	priceDirection: boolean,
): Promise<Q96> => {
	const pools = await getPool(methodContext, stores, poolID);
	if (pools == null) {
		throw new Error();
	}
	const q96SqrtPrice = bytesToQ96(pools.sqrtPrice);
	if (priceDirection) {
		return q96SqrtPrice;
	}
	return invQ96(q96SqrtPrice);
};

export const getDexGlobalData = async (
	methodContext: MethodContext,
	stores: NamedRegistry,
): Promise<DexGlobalStoreData> => {
	const dexGlobalStore = stores.get(DexGlobalStore);
	return dexGlobalStore.get(methodContext, Buffer.from([]));
};

export const getPoolIDFromTickID = (tickID: TickID) => tickID.slice(0, NUM_BYTES_POOL_ID);

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

export const getTickWithTickId = async (
	methodContext: MethodContext,
	stores: NamedRegistry,
	tickId: TickID[],
) => {
	const priceTicksStore = stores.get(PriceTicksStore);
	const priceTicksStoreData = await priceTicksStore.getKey(methodContext, tickId);
	if (priceTicksStoreData == null) {
		throw new Error('No tick with the specified poolId');
	} else {
		return priceTicksStoreData;
	}
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

export const dryRunSwapExactIn = async (
	methodContext: MethodContext,
	stores: NamedRegistry,
	tokenIdIn: TokenID,
	amountIn: bigint,
	tokenIdOut: TokenID,
	minAmountOut: bigint,
	swapRoute: PoolID[],
): Promise<[bigint, bigint, bigint, bigint]> => {
	let zeroToOne = false;
	let IdOut: TokenID = tokenIdIn;
	const tokens = [{ id: tokenIdIn, amount: amountIn }];
	const fees = [{}];
	let amountOut: bigint;
	let feesIn: bigint;
	let feesOut: bigint;
	let priceBefore: bigint;
	let newAmountIn = BigInt(0);

	if (tokenIdIn === tokenIdOut || swapRoute.length === 0 || swapRoute.length > MAX_HOPS_SWAP) {
		throw new Error('Invalid parameters');
	}
	try {
		priceBefore = await computeCurrentPrice(
			methodContext,
			stores,
			tokenIdIn,
			tokenIdOut,
			swapRoute,
		);
	} catch (error) {
		throw new Error('Invalid swap route');
	}

	for (const poolId of swapRoute) {
		const currentTokenIn = tokens[-1];

		if (getToken0Id(poolId).equals(currentTokenIn.id)) {
			zeroToOne = true;
			IdOut = getToken1Id(poolId);
		} else if (getToken1Id(poolId).equals(currentTokenIn.id)) {
			zeroToOne = false;
			IdOut = getToken0Id(poolId);
		}
		const sqrtLimitPrice = zeroToOne ? MIN_SQRT_RATIO : MAX_SQRT_RATIO;
		const currentHeight = 10;
		try {
			[newAmountIn, amountOut, feesIn, feesOut] = await swap(
				methodContext,
				stores,
				poolId,
				zeroToOne,
				sqrtLimitPrice,
				currentTokenIn.amount,
				false,
				currentHeight,
				tokenIdIn,
				tokenIdOut,
			);
		} catch (error) {
			throw new Error('Crossed too many ticks');
		}
		tokens.push({ id: IdOut, amount: amountOut });
		fees.push({ in: feesIn, out: feesOut });
	}

	if (tokens[-1].amount < minAmountOut) {
		throw new Error('Too low output amount');
	}
	const priceAfter = await computeCurrentPrice(
		methodContext,
		stores,
		tokenIdIn,
		tokenIdOut,
		swapRoute,
	);
	return [newAmountIn, tokens[-1].amount, priceBefore, priceAfter];
};

export const dryRunSwapExactOut = async (
	methodContext: MethodContext,
	stores: NamedRegistry,
	tokenIdIn: TokenID,
	maxAmountIn: bigint,
	tokenIdOut: TokenID,
	amountOut: bigint,
	swapRoute: PoolID[],
): Promise<[bigint, bigint, bigint, bigint]> => {
	let zeroToOne = false;
	let IdIn = tokenIdIn;
	const tokens = [{ id: tokenIdOut, amount: amountOut }];
	const fees = [{}];
	let amountIn: bigint;
	let feesIn: bigint;
	let feesOut: bigint;
	let priceBefore: bigint;
	let newAmountOut = BigInt(0);

	if (tokenIdIn.equals(tokenIdOut) || swapRoute.length === 0 || swapRoute.length > MAX_HOPS_SWAP) {
		throw new Error('Invalid parameters');
	}
	try {
		priceBefore = await computeCurrentPrice(
			methodContext,
			stores,
			tokenIdIn,
			tokenIdOut,
			swapRoute,
		);
	} catch (error) {
		throw new Error('Invalid swap route');
	}

	const inverseSwapRoute = swapRoute.reverse();

	for (const poolId of inverseSwapRoute) {
		const currentTokenOut = tokens[-1];
		if (getToken0Id(poolId).equals(currentTokenOut.id)) {
			zeroToOne = true;
			IdIn = getToken0Id(poolId);
		} else if (getToken1Id(poolId).equals(currentTokenOut.id)) {
			zeroToOne = false;
			IdIn = getToken1Id(poolId);
		}
		const sqrtLimitPrice = zeroToOne ? MIN_SQRT_RATIO : MAX_SQRT_RATIO;
		const currentHeight = 10;
		try {
			[amountIn, newAmountOut, feesIn, feesOut] = await swap(
				methodContext,
				stores,
				poolId,
				zeroToOne,
				sqrtLimitPrice,
				currentTokenOut.amount,
				false,
				currentHeight,
				tokenIdIn,
				tokenIdOut,
			);
		} catch (error) {
			throw new Error('Crossed too many ticks');
		}
		tokens.push({ id: IdIn, amount: amountIn });
		fees.push({ in: feesIn, out: feesOut });
	}
	if (tokens[-1].amount < maxAmountIn) {
		throw new Error('Too low output amount');
	}
	const priceAfter = await computeCurrentPrice(
		methodContext,
		stores,
		tokenIdIn,
		tokenIdOut,
		swapRoute,
	);
	return [tokens[-1].amount, newAmountOut, priceBefore, priceAfter];
};

export const getLSKPrice = async (
	tokenMethod: TokenMethod,
	methodContext: MethodContext,
	stores: NamedRegistry,
	tokenId: TokenID,
): Promise<bigint> => {
	let tokenRoute = await computeRegularRoute(methodContext, stores, tokenId, TOKEN_ID_LSK);
	let price = BigInt(1);

	if (tokenRoute.length === 0) {
		tokenRoute = await computeExceptionalRoute(methodContext, stores, tokenId, TOKEN_ID_LSK);
	}
	if (tokenRoute.length === 0) {
		throw new Error('No swap route between LSK and the given token');
	}

	let tokenIn = tokenRoute[0];
	for (const rt of tokenRoute) {
		const credibleDirectPrice = await getCredibleDirectPrice(
			tokenMethod,
			methodContext,
			stores,
			tokenIn,
			rt,
		);
		if (tokenIn < rt) {
			price = mulQ96(price, credibleDirectPrice);
		} else {
			price = divQ96(price, credibleDirectPrice);
		}
		tokenIn = rt;
	}
	return price;
};

export const getTVL = async (
	tokenMethod: TokenMethod,
	methodContext: MethodContext,
	stores: NamedRegistry,
	poolId: PoolID,
): Promise<bigint> => {
	const pool = await getPool(methodContext, stores, poolId);
	const token1Amount = await getToken1Amount(tokenMethod, methodContext, poolId);
	const token0Amount = await getToken0Amount(tokenMethod, methodContext, poolId);
	const token0Id = getToken0Id(poolId);
	const token1Id = getToken1Id(poolId);

	if (getToken0Id(poolId).equals(TOKEN_ID_LSK)) {
		const token1ValueQ96 = divQ96(
			divQ96(BigInt(token1Amount), bytesToQ96(pool.sqrtPrice)),
			bytesToQ96(pool.sqrtPrice),
		);
		return (
			roundDownQ96(token1ValueQ96) + (await getToken0Amount(tokenMethod, methodContext, poolId))
		);
	}
	if (getToken1Id(poolId).equals(TOKEN_ID_LSK)) {
		const token0ValueQ96 = mulQ96(
			mulQ96(BigInt(token0Amount), bytesToQ96(pool.sqrtPrice)),
			bytesToQ96(pool.sqrtPrice),
		);
		return (
			roundDownQ96(token0ValueQ96) + (await getToken1Amount(tokenMethod, methodContext, poolId))
		);
	}

	const value0Q96 = mulQ96(
		await getLSKPrice(tokenMethod, methodContext, stores, token0Id),
		BigInt(token0Amount),
	);
	const value1Q96 = mulQ96(
		await getLSKPrice(tokenMethod, methodContext, stores, token1Id),
		BigInt(token1Amount),
	);
	return roundDownQ96(addQ96(value0Q96, value1Q96));
};

export const getCollectableFeesAndIncentives = async (
	methodContext: MethodContext,
	stores: NamedRegistry,
	positionId: PositionID
) => {
	const positionsStore = stores.get(PositionsStore);
	const positionStoreData = await positionsStore.get(methodContext, positionId);

	if (!positionStoreData) {
		throw new Error("The position is not registered!");
	}

	const [
		collectableFees0,
		collectableFees1,
		feeGrowthInside0,
		feeGrowthInside1
	] = await computeCollectableFees(
		stores,
		methodContext,
		positionId
	);

	const poolId = await getPoolIDFromPositionID(positionId);
}