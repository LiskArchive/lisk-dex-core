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

import { MethodContext, ModuleEndpointContext, TokenMethod } from 'lisk-sdk';
import { SwapFailedEvent } from '../events/swapFailed';
import {
	Address,
	AdjacentEdgesInterface,
	PoolID,
	PoolsGraph,
	routeInterface,
	TokenID,
} from '../types';
import { NamedRegistry } from 'lisk-framework/dist-node/modules/named_registry';
import { getToken0Id, getToken1Id, transferFromPool } from './auxiliaryFunctions';
import { computeNextPrice, getAmount0Delta, getAmount1Delta } from './math';
import { DexModule } from '../module';
import { DexEndpoint } from '../endpoint';
import { bytesToQ96, invQ96, mulDivQ96, mulQ96, roundDownQ96 } from './q96';
import {
	ADDRESS_VALIDATOR_INCENTIVES,
	FEE_TIER_PARTITION,
	MODULE_NAME_DEX,
	TOKEN_ID_LSK,
	VALIDATORS_LSK_INCENTIVE_PART,
} from '../constants';

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
	// eslint-disable-next-line @typescript-eslint/no-misused-promises
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
		);
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
