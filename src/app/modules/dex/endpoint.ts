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

import { BaseEndpoint, MethodContext } from 'lisk-sdk';
import { PoolsStore, PriceTicksStore } from './stores';
import { PoolID, PositionID, Q96, TickID, TokenID } from './types';
import { NamedRegistry } from 'lisk-framework/dist-node/modules/named_registry';
import { getPoolIDFromPositionID, getToken0Id, getToken1Id } from './utils/auxiliaryFunctions';
import { PoolsStoreData } from './stores/poolsStore';
import { bytesToQ96, invQ96 } from './utils/q96';
import { DexGlobalStore, DexGlobalStoreData } from './stores/dexGlobalStore';
import { PositionsStore, PositionsStoreData } from './stores/positionsStore';
import { PriceTicksStoreData, tickToBytes } from './stores/priceTicksStore';

export class DexEndpoint extends BaseEndpoint {
	public async getAllPoolIDs(
		methodContext: MethodContext,
		poolStore: PoolsStore,
	): Promise<PoolID[]> {
		const poolIds: PoolID[] = [];
		const allPoolIds = await poolStore.getAll(methodContext);
		if (allPoolIds && allPoolIds.length) {
			allPoolIds.forEach(poolId => {
				poolIds.push(poolId.key);
			});
		}
		return poolIds;
	}

	public async getAllTokenIDs(
		methodContext: MethodContext,
		stores: NamedRegistry,
	): Promise<Set<TokenID>> {
		const tokens = new Set<TokenID>();
		const allPoolIds = await this.getAllPoolIDs(methodContext, stores.get(PoolsStore));

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

	public async getPool(
		methodContext,
		stores: NamedRegistry,
		poolID: PoolID,
	): Promise<PoolsStoreData> {
		const poolsStore = stores.get(PoolsStore);
		const poolStoreData = await poolsStore.getKey(methodContext, [poolID]);
		return poolStoreData;
	}

	public async getCurrentSqrtPrice(
		methodContext: MethodContext,
		stores: NamedRegistry,
		poolID: PoolID,
		priceDirection: boolean,
	): Promise<Q96> {
		const pools = await this.getPool(methodContext, stores, poolID);
		if (pools == null) {
			throw new Error();
		}
		const q96SqrtPrice = bytesToQ96(pools.sqrtPrice);
		if (priceDirection) {
			return q96SqrtPrice;
		}
		return invQ96(q96SqrtPrice);
	}

	public async getDexGlobalData(
		methodContext: MethodContext,
		stores: NamedRegistry,
	): Promise<DexGlobalStoreData> {
		const dexGlobalStore = stores.get(DexGlobalStore);
		return dexGlobalStore.get(methodContext, Buffer.from([]));
	}

	public async getPosition(
		methodContext: MethodContext,
		stores: NamedRegistry,
		positionID: PositionID,
		positionIdsList: PositionID[],
	): Promise<PositionsStoreData> {
		if (positionIdsList.includes(positionID)) {
			throw new Error();
		}
		const positionsStore = stores.get(PositionsStore);
		const positionStoreData = await positionsStore.get(methodContext, positionID);
		return positionStoreData;
	}

	public async getTickWithTickId(
		methodContext: MethodContext,
		stores: NamedRegistry,
		tickId: TickID[],
	): Promise<PriceTicksStoreData> {
		const priceTicksStore = stores.get(PriceTicksStore);
		const priceTicksStoreData = await priceTicksStore.getKey(methodContext, tickId);
		if (priceTicksStoreData == null) {
			throw new Error('No tick with the specified poolId');
		} else {
			return priceTicksStoreData;
		}
	}

	public async getTickWithPoolIdAndTickValue(
		methodContext: MethodContext,
		stores: NamedRegistry,
		poolId: PoolID,
		tickValue: number,
	): Promise<PriceTicksStoreData> {
		const priceTicksStore = stores.get(PriceTicksStore);
		const key = poolId.toLocaleString() + tickToBytes(tickValue).toLocaleString();
		const priceTicksStoreData = await priceTicksStore.get(methodContext, Buffer.from(key, 'hex'));
		if (priceTicksStoreData == null) {
			throw new Error('No tick with the specified poolId and tickValue');
		} else {
			return priceTicksStoreData;
		}
	}
}
