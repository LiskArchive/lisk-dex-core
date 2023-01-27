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

import { MODULE_ID_DEX, NUM_BYTES_POOL_ID } from './constants';
import { NUM_BYTES_ADDRESS, NUM_BYTES_POSITION_ID } from './constants';
import {
	getAllPositionIDsInPoolRequestSchema,
	getCurrentSqrtPriceRequestSchema,
	getFeeTierResquestSchema,
	getPoolRequestSchema,
	getPositionRequestSchema,
	getToken0AmountRequestSchema,
	getToken1AmountRequestSchema,
} from './schemas';
import { PoolsStore } from './stores';
import { PoolID, PositionID, Q96, TickID, TokenID } from './types';
import {
	getPoolIDFromPositionID,
	getToken0Id,
	getToken1Id,
	poolIdToAddress,
} from './utils/auxiliaryFunctions';
import { PoolsStoreData } from './stores/poolsStore';
import { bytesToQ96, invQ96 } from './utils/q96';
import { DexGlobalStore, DexGlobalStoreData } from './stores/dexGlobalStore';
import { PositionsStore, PositionsStoreData } from './stores/positionsStore';
import { PriceTicksStore, PriceTicksStoreData, tickToBytes } from './stores/priceTicksStore';
import { uint32beInv } from './utils/bigEndian';
import { validator } from '@liskhq/lisk-validator';

export class DexEndpoint extends BaseEndpoint {
	public async getAllPoolIDs(methodContext: ModuleEndpointContext): Promise<PoolID[]> {
		const poolStore = this.stores.get(PoolsStore);
		const store = await poolStore.getAll(methodContext);
		const poolIds: PoolID[] = [];
		if (store && store.length) {
			store.forEach(poolId => {
				poolIds.push(poolId.key);
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
		validator.validate<{ poolId: Buffer; positionIdsList: PositionID[] }>(
			getAllPositionIDsInPoolRequestSchema,
			methodContext.params,
		);
		const result: Buffer[] = [];
		const poolId = methodContext.params.poolId;
		const positionIdsList = methodContext.params.positionIdsList;
		positionIdsList.forEach(positionId => {
			if (getPoolIDFromPositionID(positionId).equals(poolId)) {
				result.push(positionId);
			}
		});
		return result;
	}

	public async getDexGlobalData(methodContext: ModuleEndpointContext): Promise<DexGlobalStoreData> {
		const dexGlobalStore = this.stores.get(DexGlobalStore);
		return dexGlobalStore.get(methodContext, Buffer.from([]));
	}

	public async getPosition(methodContext: ModuleEndpointContext): Promise<PositionsStoreData> {
		validator.validate<{ positionId: Buffer; positionIdsList: PositionID[] }>(
			getPositionRequestSchema,
			methodContext.params,
		);
		if (methodContext.params.positionIdsList.includes(methodContext.params.positionId)) {
			throw new Error();
		}
		const positionsStore = this.stores.get(PositionsStore);
		const positionStoreData = await positionsStore.get(
			methodContext,
			methodContext.params.positionId,
		);
		return positionStoreData;
	}

	public async getPool(methodContext: ModuleEndpointContext): Promise<PoolsStoreData> {
		validator.validate<{ poolId: Buffer }>(getPoolRequestSchema, methodContext.params);
		const poolsStore = this.stores.get(PoolsStore);
		const key = await poolsStore.getKey(methodContext, [methodContext.params.poolId]);
		return key;
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
		poolId: PoolID,
		tickValue: number,
	): Promise<PriceTicksStoreData> {
		const priceTicksStore = this.stores.get(PriceTicksStore);
		const key = poolId.toLocaleString() + tickToBytes(tickValue).toLocaleString();
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
	): Promise<bigint> {
		validator.validate<{ poolId: Buffer }>(getToken1AmountRequestSchema, methodContext.params);
		const address = poolIdToAddress(methodContext.params.poolId);
		const tokenId = getToken1Id(methodContext.params.poolId);
		return tokenMethod.getLockedAmount(methodContext, address, tokenId, MODULE_ID_DEX.toString());
	}

	public async getToken0Amount(
		tokenMethod: TokenMethod,
		methodContext: ModuleEndpointContext,
	): Promise<bigint> {
		validator.validate<{ poolId: Buffer }>(getToken0AmountRequestSchema, methodContext.params);
		const address = poolIdToAddress(methodContext.params.poolId);
		const tokenId = getToken0Id(methodContext.params.poolId);
		return tokenMethod.getLockedAmount(methodContext, address, tokenId, MODULE_ID_DEX.toString());
	}

	public getFeeTier(methodContext: ModuleEndpointContext): number {
		validator.validate<{ poolId: Buffer }>(getFeeTierResquestSchema, methodContext.params);
		const _buffer: Buffer = methodContext.params.poolId.slice(-4);
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
	public async getCurrentSqrtPrice(methodContext: ModuleEndpointContext): Promise<Q96> {
		validator.validate<{ poolId: Buffer; priceDirection: false }>(
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
