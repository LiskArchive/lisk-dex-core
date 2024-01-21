/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable no-param-reassign */
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

import { ModuleEndpointContext, TokenMethod } from 'lisk-sdk';
import { MethodContext } from 'lisk-framework/dist-node/state_machine';
import { NamedRegistry } from 'lisk-framework/dist-node/modules/named_registry';
import {
	Address,
	AdjacentEdgesInterface,
	PoolID,
	PoolsGraph,
	routeInterface,
	TickID,
	TokenID,
} from '../types';
import { SwapFailedEvent } from '../events/swapFailed';
import { getToken0Id, getToken1Id, transferFromPool } from './auxiliaryFunctions';
import {
	computeNextPrice,
	getAmount0Delta,
	getAmount1Delta,
	priceToTick,
	tickToPrice,
} from './math';
import { DexModule } from '../module';
import { DexEndpoint } from '../endpoint';
import {
	addQ96,
	bytesToQ96,
	divQ96,
	invQ96,
	mulDivQ96,
	// mulDivRoundUpQ96,
	mulQ96,
	numberToQ96,
	q96ToBytes,
	roundDownQ96,
	roundUpQ96,
	subQ96,
} from './q96';
import {
	ADDRESS_VALIDATOR_INCENTIVES,
	FEE_TIER_PARTITION,
	MAX_NUMBER_CROSSED_TICKS,
	MODULE_NAME_DEX,
	NUM_BYTES_POOL_ID,
	TOKEN_ID_LSK,
	VALIDATORS_LSK_INCENTIVE_PART,
	MAX_UINT_64,
	MAX_HOPS_SWAP,
} from '../constants';
import { DexGlobalStore, PriceTicksStore } from '../stores';
import { tickToBytes } from '../stores/priceTicksStore';
import { getLPIncentivesInRange } from '../../dexIncentives/utils/auxiliaryFunctions';
import { DexGlobalStoreData } from '../stores/dexGlobalStore';

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
	methodContext,
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
	throw new Error('SwapFailedEvent');
};

export const getAdjacent = async (
	methodContext,
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
	methodContext,
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
	methodContext,
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
			mulDivQ96(
				numberToQ96(BigInt(amount)),
				numberToQ96(BigInt(VALIDATORS_LSK_INCENTIVE_PART)),
				numberToQ96(BigInt(FEE_TIER_PARTITION)),
			),
		);
	}
	if (validatorFee > 0) {
		// eslint-disable-next-line
		transferFromPool(
			tokenMethod,
			methodContext,
			pool,
			ADDRESS_VALIDATOR_INCENTIVES,
			id,
			validatorFee,
		);
		// eslint-disable-next-line @typescript-eslint/no-floating-promises
		tokenMethod.lock(
			methodContext,
			ADDRESS_VALIDATOR_INCENTIVES,
			MODULE_NAME_DEX,
			id,
			validatorFee,
		);
	}
};

export const computeRegularRoute = async (
	methodContext: ModuleEndpointContext,
	stores: NamedRegistry,
	tokenIn: TokenID,
	tokenOut: TokenID,
): Promise<TokenID[]> => {
	const lskAdjacent = await getAdjacent(methodContext, stores, TOKEN_ID_LSK);
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
	const tokenInAdjacent = await getAdjacent(methodContext, stores, tokenIn);

	tokenInAdjacent.forEach(lskAdjacentEdge => {
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
				if (!visited.includes(adjacentEdge.vertex)) {
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

export const updatePoolIncentives = async (
	methodContext: ModuleEndpointContext | MethodContext,
	stores: NamedRegistry,
	poolID: PoolID,
	currentHeight: number,
) => {
	const dexModule = new DexModule();
	const endpoint = new DexEndpoint(stores, dexModule.offchainStores);
	const dexGlobalStore = stores.get(DexGlobalStore);
	const dexGlobalStoreData = await dexGlobalStore.get(methodContext, Buffer.from([]));
	let incentivizedPools: { poolId: Buffer; multiplier: number } | undefined;

	// eslint-disable-next-line
	dexGlobalStoreData.incentivizedPools.forEach(
		(incentivizedPool: { poolId: Buffer; multiplier: number } | undefined) => {
			if (incentivizedPool?.poolId.equals(poolID)) {
				incentivizedPools = incentivizedPool;
			}
		},
	);

	if (incentivizedPools == null) {
		return;
	}

	const pool = await endpoint.getPool(methodContext, poolID);
	const allPoolIds = await endpoint.getAllPoolIDs(methodContext);
	if (!allPoolIds.includes(poolID) || pool.heightIncentivesUpdate >= currentHeight) {
		return;
	}

	const newIncentivesPerLiquidity = await computeNewIncentivesPerLiquidity(
		methodContext,
		stores,
		poolID,
		currentHeight,
	);
	pool.incentivesPerLiquidityAccumulator = q96ToBytes(newIncentivesPerLiquidity);
	pool.heightIncentivesUpdate = currentHeight.valueOf();
};

export const computeNewIncentivesPerLiquidity = async (
	methodContext: ModuleEndpointContext | MethodContext,
	stores: NamedRegistry,
	poolID: PoolID,
	currentHeight: number,
): Promise<bigint> => {
	const dexModule = new DexModule();
	const endpoint = new DexEndpoint(stores, dexModule.offchainStores);
	const dexGlobalStore = stores.get(DexGlobalStore);
	const dexGlobalStoreData: DexGlobalStoreData = await dexGlobalStore.get(
		methodContext,
		Buffer.from([]),
	);
	let incentivizedPools: { poolId: Buffer; multiplier: number } | undefined;

	dexGlobalStoreData.incentivizedPools.forEach(
		(incentivizedPool: { poolId: Buffer; multiplier: number } | undefined) => {
			if (incentivizedPool?.poolId.equals(poolID)) {
				incentivizedPools = incentivizedPool;
			}
		},
	);

	if (incentivizedPools == null) {
		throw new Error('Invalid arguments');
	}

	const pool = await endpoint.getPool(methodContext, poolID);
	const allPoolIds = await endpoint.getAllPoolIDs(methodContext);
	if (!allPoolIds.includes(poolID) || pool.heightIncentivesUpdate >= currentHeight) {
		throw new Error('Invalid arguments');
	}

	const poolMultiplier = BigInt(incentivizedPools.multiplier);
	const totalIncentives = getLPIncentivesInRange(pool.heightIncentivesUpdate, currentHeight);

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
	methodContext: ModuleEndpointContext | MethodContext,
	stores: NamedRegistry,
	tickId: TickID,
	leftToRight: boolean,
	currentHeight: number,
) => {
	const dexModule = new DexModule();
	const endpoint = new DexEndpoint(stores, dexModule.offchainStores);
	const poolId = tickId.slice(0, NUM_BYTES_POOL_ID);
	await updatePoolIncentives(methodContext, stores, poolId, currentHeight);
	const poolStoreData = await endpoint.getPool(methodContext, poolId);
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

export const swap = async (
	methodContext: ModuleEndpointContext | MethodContext,
	stores: NamedRegistry,
	poolID: PoolID,
	zeroToOne: boolean,
	sqrtLimitPrice: bigint,
	amountSpecified: bigint,
	exactInput: boolean,
	currentHeight: number,
): Promise<[bigint, bigint, bigint, bigint, number]> => {
	const dexModule = new DexModule();
	const endpoint = new DexEndpoint(stores, dexModule.offchainStores);
	const feeTier = endpoint.getFeeTier(poolID);

	const poolInfo = await endpoint.getPool(methodContext, poolID);

	const priceTicksStore = stores.get(PriceTicksStore);

	let poolSqrtPriceQ96 = bytesToQ96(poolInfo.sqrtPrice);
	let numCrossedTicks = 0;
	let amountRemaining = amountSpecified;
	let amountTotalIn = BigInt(0);
	let amountTotalOut = BigInt(0);
	let totalFeesIn = BigInt(0);
	let totalFeesOut = BigInt(0);
	let nextTick;
	let sqrtTargetPrice;
	let amountIn: bigint;
	let amountOut: bigint;
	let tokenIn: Buffer;
	let tokenOut: Buffer;
	let tickExist;
	let amountRemainingTemp;
	let feeIn;
	let feeOut;

	if (
		(zeroToOne && sqrtLimitPrice >= poolSqrtPriceQ96) ||
		(!zeroToOne && sqrtLimitPrice <= poolSqrtPriceQ96)
	) {
		return [BigInt(0), BigInt(0), BigInt(0), BigInt(0), 0];
	}

	if (zeroToOne) {
		tokenIn = getToken0Id(poolID);
		tokenOut = getToken1Id(poolID);
	} else {
		tokenIn = getToken1Id(poolID);
		tokenOut = getToken0Id(poolID);
	}

	while (amountRemaining !== BigInt(0) && poolSqrtPriceQ96 !== sqrtLimitPrice) {
		if (numCrossedTicks >= MAX_NUMBER_CROSSED_TICKS) {
			throw new Error('Crossed too many ticks');
		}
		const currentTick = priceToTick(poolSqrtPriceQ96);
		if (await endpoint.getTickWithPoolIdAndTickValue(methodContext, poolID, currentTick)) {
			tickExist = true;
		}
		if (
			zeroToOne &&
			tickExist &&
			poolSqrtPriceQ96 === tickToPrice(currentTick) &&
			currentTick !== 0
		) {
			await crossTick(methodContext, stores, q96ToBytes(BigInt(currentTick)), false, currentHeight);
			numCrossedTicks += 1;
		}

		if (zeroToOne) {
			nextTick = await priceTicksStore.getPrevTick(methodContext, [
				q96ToBytes(BigInt(currentTick)),
			]);
		} else {
			nextTick = await priceTicksStore.getNextTick(methodContext, [
				q96ToBytes(BigInt(currentTick)),
			]);
		}

		const sqrtNextTickPriceQ96 = tickToPrice(nextTick);

		if (nextTick === null) {
			if (
				zeroToOne &&
				tickExist &&
				poolSqrtPriceQ96 === tickToPrice(currentTick) &&
				currentTick !== 0
			) {
				numCrossedTicks -= 1;
			}
			break;
		}

		if (poolInfo.liquidity !== BigInt(0)) {
			if (
				(zeroToOne && sqrtNextTickPriceQ96 < sqrtLimitPrice) ||
				(!zeroToOne && sqrtNextTickPriceQ96 > sqrtLimitPrice)
			) {
				sqrtTargetPrice = sqrtLimitPrice;
			} else {
				sqrtTargetPrice = sqrtNextTickPriceQ96;
			}

			const feeCoeffAmountAfter = divQ96(
				BigInt(feeTier / 2),
				BigInt(FEE_TIER_PARTITION - feeTier / 2),
			);
			const feeCoeffAmountBefore = divQ96(BigInt(feeTier / 2), BigInt(FEE_TIER_PARTITION));

			if (exactInput) {
				const firstInFee = roundUpQ96(mulQ96(BigInt(amountRemaining), feeCoeffAmountBefore));
				amountRemainingTemp = amountRemaining - firstInFee;
			} else if (!exactInput) {
				const firstOutFee = roundUpQ96(mulQ96(BigInt(amountRemaining), feeCoeffAmountAfter));
				amountRemainingTemp = amountRemaining + firstOutFee;
			}

			[poolSqrtPriceQ96, amountIn, amountOut] = swapWithin(
				poolSqrtPriceQ96,
				sqrtTargetPrice,
				poolInfo.liquidity,
				amountRemainingTemp,
				exactInput,
			);

			if (poolSqrtPriceQ96 !== sqrtTargetPrice) {
				if (exactInput) {
					feeIn = amountRemaining - amountIn;
					feeOut = roundUpQ96(mulQ96(BigInt(amountOut), feeCoeffAmountBefore));
				} else if (!exactInput) {
					feeIn = roundUpQ96(mulQ96(BigInt(amountIn), feeCoeffAmountAfter));
					feeOut = amountOut - amountRemaining;
				}
			} else {
				feeIn = roundUpQ96(mulQ96(BigInt(amountIn), feeCoeffAmountAfter));
				feeOut = roundUpQ96(mulQ96(BigInt(amountOut), feeCoeffAmountBefore));
			}
			if (exactInput) {
				amountRemaining -= amountIn + BigInt(feeIn);
			} else {
				amountRemaining -= amountOut - BigInt(feeOut);
			}

			amountTotalOut += amountOut - BigInt(feeOut);
			amountTotalIn += amountIn + BigInt(feeIn);

			totalFeesIn += feeIn;
			totalFeesOut += feeOut;

			const validatorFeePartIn = tokenIn.equals(TOKEN_ID_LSK) ? VALIDATORS_LSK_INCENTIVE_PART : 0;
			const validatorFeePartOut = tokenOut.equals(TOKEN_ID_LSK) ? VALIDATORS_LSK_INCENTIVE_PART : 0;

			const liquidityFeeInQ96 = mulDivQ96(
				BigInt(feeIn),
				BigInt(FEE_TIER_PARTITION - validatorFeePartIn),
				BigInt(FEE_TIER_PARTITION),
			);
			const liquidityFeeOutQ96 = mulDivQ96(
				BigInt(feeOut),
				BigInt(FEE_TIER_PARTITION - validatorFeePartOut),
				BigInt(FEE_TIER_PARTITION),
			);

			const liquidityFee0Q96 = zeroToOne ? liquidityFeeInQ96 : liquidityFeeOutQ96;
			const liquidityFee1Q96 = zeroToOne ? liquidityFeeOutQ96 : liquidityFeeInQ96;

			const globalFees0Q96 = divQ96(liquidityFee0Q96, BigInt(poolInfo.liquidity));
			const globalFees1Q96 = divQ96(liquidityFee1Q96, BigInt(poolInfo.liquidity));

			const feeGrowthGlobal0Q96 = bytesToQ96(poolInfo.feeGrowthGlobal0);
			poolInfo.feeGrowthGlobal0 = q96ToBytes(addQ96(feeGrowthGlobal0Q96, globalFees0Q96));
			const feeGrowthGlobal1Q96 = bytesToQ96(poolInfo.feeGrowthGlobal1);
			poolInfo.feeGrowthGlobal1 = q96ToBytes(addQ96(feeGrowthGlobal1Q96, globalFees1Q96));
		} else {
			poolSqrtPriceQ96 = sqrtNextTickPriceQ96;
		}

		if (poolSqrtPriceQ96 === sqrtNextTickPriceQ96 && !zeroToOne) {
			await crossTick(
				methodContext,
				stores,
				Buffer.concat([poolID, tickToBytes(nextTick)]),
				true,
				currentHeight,
			);
			numCrossedTicks += 1;
		}
	}
	poolInfo.sqrtPrice = q96ToBytes(poolSqrtPriceQ96);
	return [amountTotalIn, amountTotalOut, totalFeesIn, totalFeesOut, numCrossedTicks];
};

export const getRoute = async (
	methodContext: ModuleEndpointContext,
	stores: NamedRegistry,
	tokenIn: TokenID,
	tokenOut: TokenID,
	amount: bigint,
	exactIn: boolean,
): Promise<TokenID[]> => {
	let bestRoute: Buffer[] = [];
	const regularRoute = await computeRegularRoute(methodContext, stores, tokenIn, tokenOut);
	const dexModule = new DexModule();
	const endpoint = new DexEndpoint(stores, dexModule.offchainStores);
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
			for (let i = regularRoute.length - 1; i >= 0; i -= 1) {
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
		const dexGlobalData = await endpoint.getDexGlobalData(methodContext);

		for (const setting of dexGlobalData.poolCreationSettings) {
			const feeTierBuffer = Buffer.alloc(4);
			feeTierBuffer.writeUInt32BE(setting.feeTier, 0);
			const candidatePool = Buffer.concat([token0, token1, feeTierBuffer]);
			candidatePools.push(candidatePool);
		}

		let maxLiquidity = BigInt(0);
		let searchPool;
		for (const candidatePool of candidatePools) {
			const pool = await endpoint.getPool(methodContext, candidatePool);
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

export const getOptimalSwapPool = async (
	methodContext,
	stores: NamedRegistry,
	tokenIn: TokenID,
	tokenOut: TokenID,
	amount: bigint,
	exactIn: boolean,
): Promise<[PoolID, bigint]> => {
	let tokensArray = [tokenIn, tokenOut].sort((a, b) => (a < b ? -1 : 1));
	const token0 = tokensArray[0];
	const token1 = tokensArray[1];
	const candidatePools: Buffer[] = [];
	const dexModule = new DexModule();
	const endpoint = new DexEndpoint(stores, dexModule.offchainStores);
	const dexGlobalData = await endpoint.getDexGlobalData(methodContext);
	let searchindex;
	let searchElement;

	for (const settings of dexGlobalData.poolCreationSettings) {
		tokensArray = [token0, token1];
		const concatedTokenIDs = Buffer.concat(tokensArray);
		const tokenIDAndSettingsArray = [
			concatedTokenIDs,
			q96ToBytes(numberToQ96(BigInt(settings.feeTier))),
		];
		const potentialPoolId: Buffer = Buffer.concat(tokenIDAndSettingsArray);
		if (await endpoint.getPool(methodContext, potentialPoolId)) {
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
				methodContext.params = {
					tokenIdIn: tokenIn.toString('hex'),
					amountIn: amount.toString(),
					tokenIdOut: tokenOut.toString('hex'),
					minAmountOut: BigInt(0).toString(),
					swapRoute: [pool.toString('hex')],
				};
				const amountOut = (await endpoint.dryRunSwapExactIn(methodContext))[1];
				computedAmounts.push(amountOut);
			} catch (error) {
				throw new Error();
			}
		} else {
			try {
				methodContext.params = {
					tokenIdIn: tokenIn.toString('hex'),
					maxAmountIn: MAX_UINT_64.toString(),
					tokenIdOut: tokenOut.toString('hex'),
					amountOut: amount.toString(),
					swapRoute: [pool.toString('hex')],
				};
				const amountIn = (await endpoint.dryRunSwapExactOut(methodContext))[0];
				computedAmounts.push(amountIn);
			} catch (error) {
				throw new Error();
			}
		}
	}

	if (exactIn) {
		searchElement = BigInt(Number.MIN_SAFE_INTEGER);
		for (let i = 0; i < computedAmounts.length; i += 1) {
			if (computedAmounts[i] > searchElement) {
				searchindex = i;
				searchElement = computedAmounts[i];
			}
		}
	} else {
		searchElement = MAX_UINT_64;
		for (let i = 0; i < computedAmounts.length; i += 1) {
			if (computedAmounts[i] < searchElement) {
				searchindex = i;
				searchElement = computedAmounts[i];
			}
		}
	}

	return [candidatePools[searchindex], searchElement];
};
