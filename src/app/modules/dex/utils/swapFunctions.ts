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

import { NamedRegistry } from 'lisk-framework/dist-node/modules/named_registry';
import { MethodContext, TokenMethod } from "lisk-sdk";
import { ADDRESS_VALIDATOR_INCENTIVES, FEE_TIER_PARTITION, MAX_HOPS_SWAP, MAX_UINT_64, NUM_BYTES_POOL_ID, TOKEN_ID_LSK, VALIDATORS_LSK_INCENTIVE_PART } from '../constants';
import { SwapFailedEvent } from '../events/swapFailed';
import { PoolsStore } from '../stores';

import { Address, AdjacentEdgesInterface, PoolID, PoolsGraph, TickID, TokenID } from "../types";
import { computeExceptionalRoute, computeRegularRoute, getAllPoolIDs, getDexGlobalData, getPool, getTickWithTickId, getToken0Id, getToken1Id, transferFromPool } from './auxiliaryFunctions';
import { computeNextPrice, getAmount0Delta, getAmount1Delta} from './math';
import { dryRunSwapExactIn, dryRunSwapExactOut } from './offChainEndpoints';

import { bytesToQ96,mulDivQ96, q96ToBytes, roundDownQ96, subQ96 } from './q96';
import { updatePoolIncentives } from './tokenEcnomicsFunctions';




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
	let sqrtUpdatedPrice;

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
	const priceTickStoreData = await getTickWithTickId(methodContext, stores, [tickId]);
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

export const transferFeesFromPool = (
	tokenMethod: TokenMethod,
	methodContext: MethodContext,
	amount: number,
	id: TokenID,
	pool: PoolID,
) => {
	let validatorFee = BigInt(0);
	if (id.equals(TOKEN_ID_LSK)) {
		validatorFee = roundDownQ96(
			mulDivQ96(BigInt(amount), BigInt(VALIDATORS_LSK_INCENTIVE_PART), BigInt(FEE_TIER_PARTITION)),
		);
	}
	if (validatorFee > 0) {
		transferFromPool(
			tokenMethod,
			methodContext,
			pool,
			ADDRESS_VALIDATOR_INCENTIVES,
			id,
			validatorFee,
		).catch(err => {
			throw new Error(err);
		});
	}
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

export const constructPoolsGraph = async (
	methodContext: MethodContext,
	stores: NamedRegistry,
): Promise<PoolsGraph> => {
	const vertices = new Set<TokenID>();
	const poolIDs = await getAllPoolIDs(methodContext, stores.get(PoolsStore));
	const edges = new Set<PoolID>();
	poolIDs.forEach(poolId => {
		vertices.add(getToken0Id(poolId));
		vertices.add(getToken1Id(poolId));
		edges.add(poolId);
	});
	return { vertices, edges };
};

export const getAdjacent = async (
	methodContext: MethodContext,
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

export const getOptimalSwapPool = async (
	methodContext: MethodContext,
	stores: NamedRegistry,
	tokenIn: TokenID,
	tokenOut: TokenID,
	amount: bigint,
	exactIn: boolean,
): Promise<[PoolID, bigint]> => {
	const token0 = tokenIn.sort();
	const token1 = tokenOut.sort();
	const candidatePools: Buffer[] = [];
	const dexGlobalData = await getDexGlobalData(methodContext, stores);
	for (const settings of dexGlobalData.poolCreationSettings) {
		const tokenIDArrays = [token0, token1];
		const concatedTokenIDs = Buffer.concat(tokenIDArrays);
		const result = Buffer.alloc(4);
		const tokenIDAndSettingsArray = [
			concatedTokenIDs,
			q96ToBytes(BigInt(result.writeUInt32BE(settings.feeTier, 0))),
		];
		const potentialPoolId: Buffer = Buffer.concat(tokenIDAndSettingsArray);
		const pool = await getPool(methodContext, stores, potentialPoolId);
		if (pool != null) {
			candidatePools.push(potentialPoolId);
		}
		if (candidatePools.length === 0) {
			throw new Error('No pool swapping this pair of tokens');
		}
	}

	const computedAmounts: bigint[] = [];
	for (const pool of candidatePools) {
		if (exactIn) {
			try {
				const amountOut = (await dryRunSwapExactIn(
					methodContext,
					stores,
					tokenIn,
					amount,
					tokenOut,
					BigInt(0),
					[pool],
				))[1];
				computedAmounts.push(amountOut);
			} catch (error) {
				continue;
			}
		} else {
			try {
				const amountIn = (await dryRunSwapExactOut(
					methodContext,
					stores,
					tokenIn,
					MAX_UINT_64,
					tokenOut,
					amount,
					[pool],
				))[0];
				computedAmounts.push(amountIn);
			} catch (error) {
				continue;
			}
		}
	}
	let searchindex;
	let searchElement;
	if (exactIn) {
		searchElement = BigInt(Number.MIN_SAFE_INTEGER);
		for (let i = 0; i < computedAmounts.length; i+=1) {
			if (computedAmounts[i] > searchElement) {
				searchindex = i;
				searchElement = computedAmounts[i];
			}
		}
	} else {
		searchElement = MAX_UINT_64;
		for (let i = 0; i < computedAmounts.length; i+=1) {
			if (computedAmounts[i] < searchElement) {
				searchindex = i;
				searchElement = computedAmounts[i];
			}
		}
	}
	return [candidatePools[searchindex], searchElement];
};

export const getRoute = async (
	methodContext: MethodContext,
	stores: NamedRegistry,
	tokenIn: TokenID,
	tokenOut: TokenID,
	amount: bigint,
	exactIn: boolean,
): Promise<TokenID[]> => {
	let bestRoute: Buffer[] = [];
	const regularRoute = await computeRegularRoute(methodContext, stores, tokenIn, tokenOut);
	if (regularRoute.length > 0) {
		if (exactIn) {
			let poolTokenIn = tokenIn;
			let poolAmountIn = amount;
			for (const regularRouteRt of regularRoute) {
				const [optimalPool, poolAmountOut] = await getOptimalSwapPool(
					methodContext,
					stores,
					poolTokenIn,
					regularRouteRt,
					poolAmountIn,
					exactIn,
				);
				bestRoute.push(optimalPool);
				poolTokenIn = regularRouteRt;
				poolAmountIn = poolAmountOut;
			}
		} else {
			let poolTokenOut = tokenOut;
			let poolAmountOut = amount;
			for (let i = regularRoute.length - 1; i >= 0; i-=1) {
				const [optimalPool, poolAmountIn] = await getOptimalSwapPool(
					methodContext,
					stores,
					regularRoute[i],
					poolTokenOut,
					poolAmountOut,
					exactIn,
				);
				bestRoute.push(optimalPool);
				poolTokenOut = regularRoute[i];
				poolAmountOut = poolAmountIn;
			}
			bestRoute = bestRoute.reverse();
		}
		return bestRoute;
	}
	const exceptionalRoute = await computeExceptionalRoute(methodContext, stores, tokenIn, tokenOut);
	if (exceptionalRoute.length === 0 || exceptionalRoute.length > MAX_HOPS_SWAP) {
		return [];
	}
	let poolTokenIn = tokenIn;
	for (const exceptionalRt of exceptionalRoute) {
		const candidatePools: Buffer[] = [];
		const token0 = poolTokenIn.sort();
		const token1 = exceptionalRt.sort();
		const dexGlobalData = await getDexGlobalData(methodContext, stores);

		for (const setting of dexGlobalData.poolCreationSettings) {
			const feeTierBuffer = Buffer.alloc(4);
			feeTierBuffer.writeInt8(setting.feeTier, 0);
			const candidatePool = Buffer.concat([token0, token1, feeTierBuffer]);
			candidatePools.push(candidatePool);
		}

		let maxLiquidity = BigInt(0);
		let searchPool;
		for (const candidatePool of candidatePools) {
			const pool = await getPool(methodContext, stores, candidatePool);
			if (pool.liquidity > maxLiquidity) {
				maxLiquidity = pool.liquidity;
				searchPool = candidatePool;
			}
		}
		bestRoute.push(searchPool);
		poolTokenIn = exceptionalRt;
	}
	
	return bestRoute;
};
