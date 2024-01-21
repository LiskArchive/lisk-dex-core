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

import { BaseEndpoint, ModuleEndpointContext, TokenMethod } from 'lisk-sdk';
import { validator } from '@liskhq/lisk-validator';
import { MethodContext } from 'lisk-framework/dist-node/state_machine';
import {
	MODULE_ID_DEX,
	NUM_BYTES_POOL_ID,
	TOKEN_ID_LSK,
	NUM_BYTES_ADDRESS,
	NUM_BYTES_POSITION_ID,
	MAX_HOPS_SWAP,
	MIN_SQRT_RATIO,
	MAX_SQRT_RATIO,
} from './constants';
import { PoolsStore } from './stores';
import { PoolID, PositionID, Q96, TickID, TokenID } from './types';
// eslint-disable-next-line import/no-cycle
import {
	computeCollectableFees,
	computeCollectableIncentives,
	computeExceptionalRoute,
	computeRegularRoute,
	getPoolIDFromPositionID,
	getToken0Id,
	getToken1Id,
	poolIdToAddress,
} from './utils/auxiliaryFunctions';

import { computeCurrentPrice, swap } from './utils/swapFunctions';
import { PoolsStoreData } from './stores/poolsStore';

import {
	getPositionIndexRequestSchema,
	dryRunSwapExactInRequestSchema,
	dryRunSwapExactOutRequestSchema,
	getCollectableFeesAndIncentivesRequestSchema,
	getCurrentSqrtPriceRequestSchema,
} from './schemas';

import { addQ96, bytesToQ96, divQ96, invQ96, roundDownQ96, mulQ96 } from './utils/q96';
import { DexGlobalStore, DexGlobalStoreData } from './stores/dexGlobalStore';
import { PositionsStore, PositionsStoreData } from './stores/positionsStore';
import { PriceTicksStore, PriceTicksStoreData, tickToBytes } from './stores/priceTicksStore';
import { uint32beInv } from './utils/bigEndian';
import { getCredibleDirectPrice } from './utils/tokenEconomicsFunctions';

export class DexEndpoint extends BaseEndpoint {
	public async getAllPoolIDs(methodContext): Promise<PoolID[]> {
		const poolStore = this.stores.get(PoolsStore);
		const store = await poolStore.getAll(methodContext);
		const poolIds: PoolID[] = [];
		// eslint-disable-next-line @typescript-eslint/prefer-optional-chain
		if (store && store.length) {
			store.forEach(poolID => {
				poolIds.push(poolID.key);
			});
		}
		return poolIds;
	}

	public async getAllTokenIDs(methodContext): Promise<Set<TokenID>> {
		const tokens = new Set<TokenID>();
		const allPoolIds = await this.getAllPoolIDs(methodContext);
		if (allPoolIds != null && allPoolIds.length > 0) {
			allPoolIds.forEach(poolID => {
				tokens.add(getToken0Id(poolID));
				tokens.add(getToken1Id(poolID));
			});
		}
		return tokens;
	}

	public getAllPositionIDsInPool(poolId: PoolID, positionIdsList: PositionID[]): Buffer[] {
		const result: Buffer[] = [];
		positionIdsList.forEach(positionId => {
			if (getPoolIDFromPositionID(positionId).equals(poolId)) {
				result.push(positionId);
			}
		});
		return result;
	}

	public async getPool(methodContext, poolID: PoolID): Promise<PoolsStoreData> {
		const poolsStore = this.stores.get(PoolsStore);
		const key = await poolsStore.getKey(methodContext, [poolID]);
		return key;
	}

	public async getCurrentSqrtPrice(methodContext: ModuleEndpointContext): Promise<Q96> {
		validator.validate<{ poolID: string; priceDirection: boolean }>(
			getCurrentSqrtPriceRequestSchema,
			methodContext.params,
		);
		const poolID = Buffer.from(methodContext.params.poolID, 'hex');
		const { priceDirection } = methodContext.params;
		const pools = await this.getPool(methodContext, poolID);
		if (pools == null) {
			throw new Error();
		}
		const q96SqrtPrice = bytesToQ96(pools.sqrtPrice);
		if (priceDirection) {
			return q96SqrtPrice;
		}
		return invQ96(q96SqrtPrice);
	}

	public async getDexGlobalData(methodContext): Promise<DexGlobalStoreData> {
		const dexGlobalStore = this.stores.get(DexGlobalStore);
		return dexGlobalStore.get(methodContext, Buffer.from([]));
	}

	public async getPosition(
		methodContext: ModuleEndpointContext,
		positionID: PositionID,
		positionIdsList: PositionID[],
	): Promise<PositionsStoreData> {
		if (positionIdsList.includes(positionID)) {
			throw new Error();
		}
		const positionsStore = this.stores.get(PositionsStore);
		const positionStoreData = await positionsStore.get(methodContext, positionID);
		return positionStoreData;
	}

	public async getTickWithTickId(
		methodContext: ModuleEndpointContext | MethodContext,
		tickId: TickID[],
	): Promise<PriceTicksStoreData> {
		const priceTicksStore = this.stores.get(PriceTicksStore);
		const priceTicksStoreData = await priceTicksStore.getKey(methodContext, tickId);
		if (priceTicksStoreData == null) {
			throw new Error('No tick with the specified poolId');
		} else {
			return priceTicksStoreData;
		}
	}

	public async getTickWithPoolIdAndTickValue(
		methodContext,
		poolId: PoolID,
		tickValue: number,
	): Promise<PriceTicksStoreData> {
		const priceTicksStore = this.stores.get(PriceTicksStore);
		const key = Buffer.concat([poolId, tickToBytes(tickValue)]);
		const priceTicksStoreData = await priceTicksStore.get(methodContext, key);
		if (priceTicksStoreData == null) {
			throw new Error('No tick with the specified poolId and tickValue');
		} else {
			return priceTicksStoreData;
		}
	}

	public async getToken1Amount(
		tokenMethod: TokenMethod,
		methodContext: ModuleEndpointContext,
		poolId: PoolID,
	): Promise<bigint> {
		const address = poolIdToAddress(poolId);
		const tokenId = getToken1Id(poolId);
		return tokenMethod.getLockedAmount(methodContext, address, tokenId, MODULE_ID_DEX.toString());
	}

	public async getToken0Amount(
		tokenMethod: TokenMethod,
		methodContext: ModuleEndpointContext,
		poolId: PoolID,
	): Promise<bigint> {
		const address = poolIdToAddress(poolId);
		const tokenId = getToken0Id(poolId);
		return tokenMethod.getLockedAmount(methodContext, address, tokenId, MODULE_ID_DEX.toString());
	}

	public getFeeTier(poolId: PoolID): number {
		const _buffer: Buffer = poolId.slice(-4);
		const _hexBuffer: string = _buffer.toString('hex');

		return uint32beInv(_hexBuffer);
	}

	public getPoolIDFromTickID(tickID: Buffer) {
		return tickID.slice(0, NUM_BYTES_POOL_ID);
	}

	public getPositionIndex(methodContext: ModuleEndpointContext): number {
		validator.validate<{ positionID: string }>(getPositionIndexRequestSchema, methodContext.params);
		const { positionID } = methodContext.params;
		const _buffer: Buffer = Buffer.from(positionID, 'hex').slice(
			-(2 * (NUM_BYTES_POSITION_ID - NUM_BYTES_ADDRESS)),
		);
		const _hexBuffer: string = _buffer.toString('hex');
		return uint32beInv(_hexBuffer);
	}

	public async getTVL(
		tokenMethod: TokenMethod,
		methodContext: ModuleEndpointContext,
		poolId: PoolID,
	): Promise<bigint> {
		const pool = await this.getPool(methodContext, poolId);
		const token1Amount = await this.getToken1Amount(tokenMethod, methodContext, poolId);
		const token0Amount = await this.getToken0Amount(tokenMethod, methodContext, poolId);
		const token0Id = getToken0Id(poolId);
		const token1Id = getToken1Id(poolId);

		if (getToken0Id(poolId).equals(TOKEN_ID_LSK)) {
			const token1ValueQ96 = divQ96(
				divQ96(BigInt(token1Amount), bytesToQ96(pool.sqrtPrice)),
				bytesToQ96(pool.sqrtPrice),
			);
			return (
				roundDownQ96(token1ValueQ96) +
				(await this.getToken0Amount(tokenMethod, methodContext, poolId))
			);
		}
		if (getToken1Id(poolId).equals(TOKEN_ID_LSK)) {
			const token0ValueQ96 = mulQ96(
				mulQ96(BigInt(token0Amount), bytesToQ96(pool.sqrtPrice)),
				bytesToQ96(pool.sqrtPrice),
			);
			return (
				roundDownQ96(token0ValueQ96) +
				(await this.getToken1Amount(tokenMethod, methodContext, poolId))
			);
		}

		const value0Q96 = mulQ96(
			await this.getLSKPrice(tokenMethod, methodContext, token0Id),
			BigInt(token0Amount),
		);
		const value1Q96 = mulQ96(
			await this.getLSKPrice(tokenMethod, methodContext, token1Id),
			BigInt(token1Amount),
		);
		return roundDownQ96(addQ96(value0Q96, value1Q96));
	}

	public async getLSKPrice(
		tokenMethod: TokenMethod,
		methodContext: ModuleEndpointContext,
		tokenId: TokenID,
	): Promise<bigint> {
		let tokenRoute = await computeRegularRoute(methodContext, this.stores, tokenId, TOKEN_ID_LSK);
		let price = BigInt(1);

		if (tokenRoute.length === 0) {
			tokenRoute = await computeExceptionalRoute(methodContext, this.stores, tokenId, TOKEN_ID_LSK);
		}
		if (tokenRoute.length === 0) {
			throw new Error('No swap route between LSK and the given token');
		}

		let tokenIn = tokenRoute[0];

		for (const rt of tokenRoute) {
			const credibleDirectPrice = await getCredibleDirectPrice(
				tokenMethod,
				methodContext,
				this.stores,
				tokenIn,
				rt,
			);

			const tokenIDArrays = [tokenIn, rt];
			// eslint-disable-next-line @typescript-eslint/require-array-sort-compare
			const [tokenID0, tokenID1] = tokenIDArrays.sort();

			if (tokenIn.equals(tokenID0) && rt.equals(tokenID1)) {
				price = mulQ96(BigInt(1), credibleDirectPrice);
			} else if (tokenIn.equals(tokenID1) && rt.equals(tokenID0)) {
				price = divQ96(BigInt(1), credibleDirectPrice);
			}
			tokenIn = rt;
		}
		return price;
	}

	public async getAllTicks(methodContext): Promise<TickID[]> {
		const tickIds: Buffer[] = [];
		const priceTicksStore = this.stores.get(PriceTicksStore);
		const allTickIds = await priceTicksStore.getAll(methodContext);
		allTickIds.forEach(tickId => {
			tickIds.push(tickId.key);
		});
		return tickIds;
	}

	public async getAllTickIDsInPool(
		methodContext: ModuleEndpointContext,
		poolId: PoolID,
	): Promise<TickID[]> {
		const result: Buffer[] = [];
		const allTicks = await this.getAllTicks(methodContext);
		allTicks.forEach(tickID => {
			if (this.getPoolIDFromTickID(tickID).equals(poolId)) {
				result.push(tickID);
			}
		});
		return result;
	}

	public async dryRunSwapExactIn(
		// methodContext: MethodContext,
		moduleEndpointContext: ModuleEndpointContext,
	): Promise<[bigint, bigint, bigint, bigint]> {
		validator.validate<{
			tokenIdIn: string;
			amountIn: string;
			tokenIdOut: string;
			minAmountOut: string;
			swapRoute: string[];
		}>(dryRunSwapExactInRequestSchema, moduleEndpointContext.params);

		const tokenIdIn = Buffer.from(moduleEndpointContext.params.tokenIdIn, 'hex');
		const amountIn = BigInt(moduleEndpointContext.params.amountIn);
		const minAmountOut = BigInt(moduleEndpointContext.params.minAmountOut);
		const tokenIdOut = Buffer.from(moduleEndpointContext.params.tokenIdOut, 'hex');
		const swapRoute = moduleEndpointContext.params.swapRoute.map(route =>
			Buffer.from(route, 'hex'),
		);

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
				moduleEndpointContext,
				this.stores,
				tokenIdIn,
				tokenIdOut,
				swapRoute,
			);
		} catch (error) {
			throw new Error('Invalid swap route');
		}

		for (const poolId of swapRoute) {
			const currentTokenIn = tokens[tokens.length - 1];

			if (getToken0Id(poolId).equals(currentTokenIn.id)) {
				zeroToOne = true;
				IdOut = getToken1Id(poolId);
			} else if (getToken1Id(poolId).equals(currentTokenIn.id)) {
				zeroToOne = false;
				IdOut = getToken0Id(poolId);
			}
			const sqrtLimitPrice = zeroToOne ? MIN_SQRT_RATIO : MAX_SQRT_RATIO;
			const currentHeight = moduleEndpointContext.header.height;
			try {
				[newAmountIn, amountOut, feesIn, feesOut] = await swap(
					moduleEndpointContext,
					this.stores,
					poolId,
					zeroToOne,
					sqrtLimitPrice,
					currentTokenIn.amount,
					false,
					currentHeight,
				);
			} catch (error) {
				throw new Error('Crossed too many ticks');
			}
			tokens.push({ id: IdOut, amount: amountOut });
			fees.push({ in: feesIn, out: feesOut });
		}

		if (tokens[tokens.length - 1].amount < minAmountOut) {
			throw new Error('Too low output amount');
		}

		const priceAfter = await computeCurrentPrice(
			moduleEndpointContext,
			this.stores,
			tokenIdIn,
			tokenIdOut,
			swapRoute,
		);
		return [newAmountIn, tokens[tokens.length - 1].amount, priceBefore, priceAfter];
	}

	public async dryRunSwapExactOut(
		moduleEndpointContext: ModuleEndpointContext,
	): Promise<[bigint, bigint, bigint, bigint]> {
		validator.validate<{
			tokenIdIn: string;
			maxAmountIn: string;
			tokenIdOut: string;
			amountOut: string;
			swapRoute: string[];
		}>(dryRunSwapExactOutRequestSchema, moduleEndpointContext.params);

		const tokenIdIn = Buffer.from(moduleEndpointContext.params.tokenIdIn, 'hex');
		const maxAmountIn = BigInt(moduleEndpointContext.params.maxAmountIn);
		const amountOut = BigInt(moduleEndpointContext.params.amountOut);
		const tokenIdOut = Buffer.from(moduleEndpointContext.params.tokenIdOut, 'hex');
		const swapRoute = moduleEndpointContext.params.swapRoute.map(route =>
			Buffer.from(route, 'hex'),
		);

		let zeroToOne = false;
		let IdIn = tokenIdIn;
		const tokens = [{ id: tokenIdOut, amount: amountOut }];
		const fees = [{}];
		let amountIn: bigint;
		let feesIn: bigint;
		let feesOut: bigint;
		let priceBefore: bigint;
		let newAmountOut = BigInt(0);

		if (swapRoute.length === 0 || swapRoute.length > MAX_HOPS_SWAP) {
			throw new Error('Invalid parameters');
		}
		try {
			priceBefore = await computeCurrentPrice(
				moduleEndpointContext,
				this.stores,
				tokenIdIn,
				tokenIdOut,
				swapRoute,
			);
		} catch (error) {
			throw new Error('Invalid swap route');
		}

		const inverseSwapRoute = swapRoute.reverse();

		for (const poolId of inverseSwapRoute) {
			const currentTokenOut = tokens[tokens.length - 1];
			if (getToken0Id(poolId).equals(currentTokenOut.id)) {
				zeroToOne = true;
				IdIn = getToken1Id(poolId);
			} else if (getToken1Id(poolId).equals(currentTokenOut.id)) {
				zeroToOne = false;
				IdIn = getToken0Id(poolId);
			}
			const sqrtLimitPrice = zeroToOne ? MIN_SQRT_RATIO : MAX_SQRT_RATIO;
			const currentHeight = moduleEndpointContext.header.height;
			try {
				[amountIn, newAmountOut, feesIn, feesOut] = await swap(
					moduleEndpointContext,
					this.stores,
					poolId,
					zeroToOne,
					sqrtLimitPrice,
					currentTokenOut.amount,
					true,
					currentHeight,
				);
			} catch (error) {
				throw new Error('Crossed too many ticks');
			}
			tokens.push({ id: IdIn, amount: amountIn });
			fees.push({ in: feesIn, out: feesOut });
		}
		if (tokens[tokens.length - 1].amount > maxAmountIn) {
			throw new Error('Too high input amount');
		}

		const priceAfter = await computeCurrentPrice(
			moduleEndpointContext,
			this.stores,
			tokenIdIn,
			tokenIdOut,
			swapRoute,
		);

		return [tokens[tokens.length - 1].amount, newAmountOut, priceBefore, priceAfter];
	}

	public async getCollectableFeesAndIncentives(
		methodContext: ModuleEndpointContext,
		tokenMethod: TokenMethod,
	) {
		validator.validate<{ positionId: string }>(
			getCollectableFeesAndIncentivesRequestSchema,
			methodContext.params,
		);

		const positionId = Buffer.from(methodContext.params.positionId, 'hex');
		const positionsStore = this.stores.get(PositionsStore);
		const hasPositionData = await positionsStore.has(methodContext, positionId);

		if (!hasPositionData) {
			throw new Error('The position is not registered!');
		}

		const [collectableFees0, collectableFees1] = await computeCollectableFees(
			this.stores,
			methodContext,
			positionId,
		);

		const dexGlobalStore = this.stores.get(DexGlobalStore);
		const [collectableIncentives] = await computeCollectableIncentives(
			dexGlobalStore,
			tokenMethod,
			methodContext,
			positionId,
			collectableFees0,
			collectableFees1,
		);
		return [collectableFees0, collectableFees1, collectableIncentives];
	}
}
