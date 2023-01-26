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

import { MethodContext, ModuleEndpointContext } from "lisk-sdk";
import { SwapFailedEvent } from "../events/swapFailed";
import { Address, AdjacentEdgesInterface, PoolID, TokenID } from "../types";
import { NamedRegistry } from 'lisk-framework/dist-node/modules/named_registry';
import { PoolsStore } from "../stores";
import { getToken0Id, getToken1Id } from "./auxiliaryFunctions";
import { computeNextPrice, getAmount0Delta, getAmount1Delta } from "./math";
import { DexModule } from '../module';
import { DexEndpoint } from '../endpoint';
import { mulQ96, bytesToQ96, invQ96 } from "./q96";

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
		const pool = await endpoint.getPool(methodContext, dexModule.stores, poolId);
		await endpoint.getPool(methodContext, dexModule.stores, poolId).catch(() => {
			throw new Error('Not a valid pool');
		})
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
