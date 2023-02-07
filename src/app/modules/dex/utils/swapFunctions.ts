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

import { MethodContext, ModuleEndpointContext } from 'lisk-sdk';
import { NamedRegistry } from 'lisk-framework/dist-node/modules/named_registry';
import { SwapFailedEvent } from '../events/swapFailed';
import { Address, AdjacentEdgesInterface, PoolID, PoolsGraph, TickID, TokenID } from '../types';
import { getToken0Id, getToken1Id } from './auxiliaryFunctions';
import { computeNextPrice, getAmount0Delta, getAmount1Delta } from './math';
import { DexModule } from '../module';
import { DexEndpoint } from '../endpoint';
import {
	addQ96,
	bytesToQ96,
	divQ96,
	invQ96,
	mulDivQ96,
	mulQ96,
	numberToQ96,
	q96ToBytes,
	subQ96,
} from './q96';
import { NUM_BYTES_POOL_ID } from '../constants';
import { DexGlobalStore } from '../stores';

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

export const raiseSwapException = (
	events: NamedRegistry,
	methodContext: MethodContext,
	reason: number,
	tokenIdIn: TokenID,
	tokenIdOut: TokenID,
	senderAddress: Address,
) => {
	events.get(SwapFailedEvent).add(
		methodContext,
		{
			senderAddress,
			tokenIdIn,
			tokenIdOut,
			reason,
		},
		[senderAddress],
		true,
	);
};

export const getAdjacent = async (
	methodContext: ModuleEndpointContext,
	stores: NamedRegistry,
	vertex: TokenID,
): Promise<AdjacentEdgesInterface[]> => {
	const dexModule = new DexModule();
	const endpoint = new DexEndpoint(stores, dexModule.offchainStores);
	const result: AdjacentEdgesInterface[] = [];
	const poolIDs = await endpoint.getAllPoolIDs(methodContext);
	poolIDs.forEach(edge => {
		if (getToken0Id(edge).equals(vertex)) {
			result.push({ edge, vertex: getToken1Id(edge) });
		} else if (getToken1Id(edge).equals(vertex)) {
			result.push({ edge, vertex: getToken0Id(edge) });
		}
	});
	return result;
};

export const computeCurrentPrice = async (
	methodContext: ModuleEndpointContext,
	stores: NamedRegistry,
	tokenIn: TokenID,
	tokenOut: TokenID,
	swapRoute: PoolID[],
): Promise<bigint> => {
	const dexModule = new DexModule();
	const endpoint = new DexEndpoint(stores, dexModule.offchainStores);
	let price = BigInt(1);
	let tokenInPool = tokenIn;
	for (const poolId of swapRoute) {
		const pool = await endpoint.getPool(methodContext, poolId);
		await endpoint.getPool(methodContext, poolId).catch(() => {
			throw new Error('Not a valid pool');
		});
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

export const constructPoolsGraph = async (
	methodContext: ModuleEndpointContext,
	stores: NamedRegistry,
): Promise<PoolsGraph> => {
	const dexModule = new DexModule();
	const endpoint = new DexEndpoint(stores, dexModule.offchainStores);
	const vertices = new Set<TokenID>();
	const poolIDs = await endpoint.getAllPoolIDs(methodContext);
	const edges = new Set<PoolID>();
	poolIDs.forEach(poolId => {
		vertices.add(getToken0Id(poolId));
		vertices.add(getToken1Id(poolId));
		edges.add(poolId);
	});
	return { vertices, edges };
};

export const updatePoolIncentives = async (
	moduleEndpointContext: ModuleEndpointContext,
	methodContext: MethodContext,
	stores: NamedRegistry,
	poolID: PoolID,
	currentHeight: number,
) => {
	const dexModule = new DexModule();
	const endpoint = new DexEndpoint(stores, dexModule.offchainStores);
	const dexGlobalStore = stores.get(DexGlobalStore);
	const dexGlobalStoreData = await dexGlobalStore.get(methodContext, Buffer.from([]));
	let incentivizedPools: { poolId: Buffer; multiplier: number } | undefined;

	dexGlobalStoreData.incentivizedPools.forEach(incentivizedPool => {
		if (incentivizedPool.poolId.equals(poolID)) {
			incentivizedPools = incentivizedPool;
		}
	});

	if (incentivizedPools == null) {
		return;
	}

	const pool = await endpoint.getPool(moduleEndpointContext, poolID);
	const allPoolIds = await endpoint.getAllPoolIDs(moduleEndpointContext);
	if (!allPoolIds.includes(poolID) || pool.heightIncentivesUpdate >= currentHeight) {
		return;
	}

	const newIncentivesPerLiquidity = await computeNewIncentivesPerLiquidity(
		moduleEndpointContext,
		methodContext,
		stores,
		poolID,
		currentHeight,
	);
	pool.incentivesPerLiquidityAccumulator = q96ToBytes(newIncentivesPerLiquidity);
	pool.heightIncentivesUpdate = currentHeight.valueOf();
};

export const computeNewIncentivesPerLiquidity = async (
	moduleEndpointContext: ModuleEndpointContext,
	methodContext: MethodContext,
	stores: NamedRegistry,
	poolID: PoolID,
	currentHeight: number,
): Promise<bigint> => {
	const dexModule = new DexModule();
	const endpoint = new DexEndpoint(stores, dexModule.offchainStores);
	const dexGlobalStore = stores.get(DexGlobalStore);
	const dexGlobalStoreData = await dexGlobalStore.get(methodContext, Buffer.from([]));
	let incentivizedPools: { poolId: Buffer; multiplier: number } | undefined;

	dexGlobalStoreData.incentivizedPools.forEach(incentivizedPool => {
		if (incentivizedPool.poolId.equals(poolID)) {
			incentivizedPools = incentivizedPool;
		}
	});

	if (incentivizedPools == null) {
		throw new Error('Invalid arguments');
	}

	const pool = await endpoint.getPool(moduleEndpointContext, poolID);
	const allPoolIds = await endpoint.getAllPoolIDs(moduleEndpointContext);
	if (!allPoolIds.includes(poolID) || pool.heightIncentivesUpdate >= currentHeight) {
		throw new Error('Invalid arguments');
	}

	const poolMultiplier = BigInt(incentivizedPools.multiplier);
	const totalIncentives = BigInt(0);

	const incentives = mulDivQ96(
		numberToQ96(totalIncentives),
		numberToQ96(poolMultiplier),
		numberToQ96(BigInt(dexGlobalStoreData.totalIncentivesMultiplier)),
	);
	const incentivesPerLiquidity = divQ96(incentives, numberToQ96(pool.liquidity));
	const currentIncentivesPerLiquidity = bytesToQ96(pool.incentivesPerLiquidityAccumulator);
	return addQ96(incentivesPerLiquidity, currentIncentivesPerLiquidity);
};

export const crossTick = async (
	moduleEnpointContext: ModuleEndpointContext,
	methodContext: MethodContext,
	stores: NamedRegistry,
	tickId: TickID,
	leftToRight: boolean,
	currentHeight: number,
) => {
	const dexModule = new DexModule();
	const endpoint = new DexEndpoint(stores, dexModule.offchainStores);
	const poolId = tickId.slice(0, NUM_BYTES_POOL_ID);
	await updatePoolIncentives(moduleEnpointContext, methodContext, stores, poolId, currentHeight);
	const poolStoreData = await endpoint.getPool(moduleEnpointContext, poolId);
	const priceTickStoreData = await endpoint.getTickWithTickId(moduleEnpointContext, [tickId]);
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
