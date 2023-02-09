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

import { BaseEndpoint, ModuleEndpointContext, TokenMethod } from 'lisk-sdk';
import { validator } from '@liskhq/lisk-validator';


import { MODULE_ID_DEX, NUM_BYTES_POOL_ID, TOKEN_ID_LSK } from './constants';
import { NUM_BYTES_ADDRESS, NUM_BYTES_POSITION_ID } from './constants';
import { PoolsStore } from './stores';
import { PoolID, PositionID, Q96, TickID, TokenID } from './types';
import {
	computeExceptionalRoute,
	computeRegularRoute,
	getCredibleDirectPrice,
	getPoolIDFromPositionID,
	getToken0Id,
	getToken1Id,
	poolIdToAddress,
} from './utils/auxiliaryFunctions';
import { PoolsStoreData } from './stores/poolsStore';
import { addQ96, bytesToQ96, divQ96, invQ96, roundDownQ96, mulQ96 } from './utils/q96';
import { DexGlobalStore, DexGlobalStoreData } from './stores/dexGlobalStore';
import { PositionsStore, PositionsStoreData } from './stores/positionsStore';
import { PriceTicksStore, PriceTicksStoreData, tickToBytes } from './stores/priceTicksStore';
import { uint32beInv } from './utils/bigEndian';
import { getAllPositionIDsInPoolRequestSchema, getCurrentSqrtPriceRequestSchema, getLSKPriceRequestSchema, getPoolRequestSchema, getPositionRequestSchema, getTVLRequestSchema } from './schemas';

export class DexEndpoint extends BaseEndpoint {
	public async getAllPoolIDs(methodContext: ModuleEndpointContext): Promise<PoolID[]> {
		const poolStore = this.stores.get(PoolsStore);
		const store = await poolStore.getAll(methodContext);
		const poolIds: PoolID[] = [];
		if (store && store.length) {
			store.forEach(poolID => {
				poolIds.push(poolID.key);
			});
		}
		return poolIds;
	}

	public async getAllTokenIDs(methodContext: ModuleEndpointContext): Promise<Set<TokenID>> {
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

public getAllPositionIDsInPool(methodContext: ModuleEndpointContext): Buffer[] {
		validator.validate<{ poolID: Buffer; positionIdsList: PositionID[] }>(
			getAllPositionIDsInPoolRequestSchema,
			methodContext.params,
		);
		const result: Buffer[] = [];
		const poolID = methodContext.params.poolID;
		const positionIdsList = methodContext.params.positionIdsList;
		positionIdsList.forEach(positionId => {
			if (getPoolIDFromPositionID(positionId).equals(poolID)) {
				result.push(positionId);
			}
		});
		return result;
	}

	public async getPool(methodContext: ModuleEndpointContext): Promise<PoolsStoreData> {
		validator.validate<{ poolID: Buffer }>(getPoolRequestSchema, methodContext.params);
		const poolsStore = this.stores.get(PoolsStore);
		const key = await poolsStore.getKey(methodContext, [methodContext.params.poolID]);
		return key;
	}

	public async getDexGlobalData(methodContext: ModuleEndpointContext): Promise<DexGlobalStoreData> {
		const dexGlobalStore = this.stores.get(DexGlobalStore);
		return dexGlobalStore.get(methodContext, Buffer.from([]));
	}

	public async getPosition(methodContext: ModuleEndpointContext): Promise<PositionsStoreData> {
		validator.validate<{ positionID: Buffer; positionIDsList: PositionID[] }>(
			getPositionRequestSchema,
			methodContext.params,
		);
		if (methodContext.params.positionIDsList.includes(methodContext.params.positionID)) {
			throw new Error();
		}
		const positionsStore = this.stores.get(PositionsStore);
		const positionStoreData = await positionsStore.get(
			methodContext,
			methodContext.params.positionID,
		);
		return positionStoreData;
	}

	public async getTickWithTickId(
		methodContext: ModuleEndpointContext,
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
		methodContext: ModuleEndpointContext,
		poolID: PoolID,
		tickValue: number,
	): Promise<PriceTicksStoreData> {
		const priceTicksStore = this.stores.get(PriceTicksStore);
		const key = poolID.toLocaleString() + tickToBytes(tickValue).toLocaleString();
		const priceTicksStoreData = await priceTicksStore.get(methodContext, Buffer.from(key, 'hex'));
		if (priceTicksStoreData == null) {
			throw new Error('No tick with the specified poolId and tickValue');
		} else {
			return priceTicksStoreData;
		}
	}

	public async getToken1Amount(
		tokenMethod: TokenMethod,
		methodContext: ModuleEndpointContext,
		poolID: PoolID,
	): Promise<bigint> {
		const address = poolIdToAddress(poolID);
		const tokenId = getToken1Id(poolID);
		return tokenMethod.getLockedAmount(methodContext, address, tokenId, MODULE_ID_DEX.toString());
	}

	public async getToken0Amount(
		tokenMethod: TokenMethod,
		methodContext: ModuleEndpointContext,
		poolID: PoolID,
	): Promise<bigint> {
		const address = poolIdToAddress(poolID);
		const tokenId = getToken0Id(poolID);
		return tokenMethod.getLockedAmount(methodContext, address, tokenId, MODULE_ID_DEX.toString());
	}

	public getFeeTier(poolID: PoolID): number {
		const _buffer: Buffer = poolID.slice(-4);
		const _hexBuffer: string = _buffer.toString('hex');

		return uint32beInv(_hexBuffer);
	}

	public getPoolIDFromTickID(tickID: Buffer) {
		return tickID.slice(0, NUM_BYTES_POOL_ID);
	}

	public getPositionIndex(positionId: PositionID): number {
		const _buffer: Buffer = positionId.slice(-(2 * (NUM_BYTES_POSITION_ID - NUM_BYTES_ADDRESS)));
		const _hexBuffer: string = _buffer.toString('hex');
		return uint32beInv(_hexBuffer);
	}

	public async getTVL(
		tokenMethod: TokenMethod,
		methodContext: ModuleEndpointContext,
	): Promise<bigint> {
		validator.validate<{ poolID: Buffer; token0ID: Buffer; token1ID: Buffer }>(
			getTVLRequestSchema,
			methodContext.params,
		);
		const poolID = methodContext.params.poolID;
		const pool = await this.getPool(methodContext);
		const token1Amount = await this.getToken1Amount(tokenMethod, methodContext, poolID);
		const token0Amount = await this.getToken0Amount(tokenMethod, methodContext, poolID);


		if (getToken0Id(poolID).equals(TOKEN_ID_LSK)) {
			const token1ValueQ96 = divQ96(
				divQ96(BigInt(token1Amount), bytesToQ96(pool.sqrtPrice)),
				bytesToQ96(pool.sqrtPrice),
			);
			return (
				roundDownQ96(token1ValueQ96) +
				(await this.getToken0Amount(tokenMethod, methodContext, poolID))
			);
		}
		if (getToken1Id(poolID).equals(TOKEN_ID_LSK)) {
			const token0ValueQ96 = mulQ96(
				mulQ96(BigInt(token0Amount), bytesToQ96(pool.sqrtPrice)),
				bytesToQ96(pool.sqrtPrice),
			);
			return (
				roundDownQ96(token0ValueQ96) +
				(await this.getToken1Amount(tokenMethod, methodContext, poolID))
			);
		}

		const value0Q96 = mulQ96(
			await this.getLSKPrice(tokenMethod, methodContext),
			BigInt(token0Amount),
		);
		const value1Q96 = mulQ96(
			await this.getLSKPrice(tokenMethod, methodContext),
			BigInt(token1Amount),
		);
		return roundDownQ96(addQ96(value0Q96, value1Q96));
	}

	public async getLSKPrice(
		tokenMethod: TokenMethod,
		methodContext: ModuleEndpointContext,

	): Promise<bigint> {
		validator.validate<{ tokenID: Buffer; poolID: Buffer }>(
			getLSKPriceRequestSchema,
			methodContext.params,
		);
		const { tokenID } = methodContext.params;
		let tokenRoute = await computeRegularRoute(methodContext, this.stores, tokenID, TOKEN_ID_LSK);
		let price = BigInt(1);

		if (tokenRoute.length === 0) {
			tokenRoute = await computeExceptionalRoute(methodContext, this.stores, tokenID, TOKEN_ID_LSK);
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

	public async getAllTicks(methodContext: ModuleEndpointContext): Promise<TickID[]> {
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
		poolID: PoolID,
	): Promise<TickID[]> {
		const result: Buffer[] = [];
		const allTicks = await this.getAllTicks(methodContext);
		allTicks.forEach(tickID => {
			if (this.getPoolIDFromTickID(tickID).equals(poolID)) {
				result.push(tickID);
			}
		});
		return result;
	}

	public async getCurrentSqrtPrice(methodContext: ModuleEndpointContext): Promise<Q96> {
		validator.validate<{ poolID: Buffer; priceDirection: false }>(
			getCurrentSqrtPriceRequestSchema,
			methodContext.params,
		);
		const pools = await this.getPool(methodContext);
		if (pools == null) {
			throw new Error();
		}
		const q96SqrtPrice = bytesToQ96(pools.sqrtPrice);
		if (methodContext.params.priceDirection) {
			return q96SqrtPrice;
		}
		return invQ96(q96SqrtPrice);
	}
}
