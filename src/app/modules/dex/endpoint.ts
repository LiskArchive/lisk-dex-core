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

import { BaseEndpoint, ModuleEndpointContext } from 'lisk-sdk';
import { PoolsStore } from './stores';
import { PoolID, PositionID, Q96, TickID, TokenID } from './types';
import { getPoolIDFromPositionID, getToken0Id, getToken1Id } from './utils/auxiliaryFunctions';
import { PoolsStoreData } from './stores/poolsStore';
import { bytesToQ96, invQ96 } from './utils/q96';
import { DexGlobalStore, DexGlobalStoreData } from './stores/dexGlobalStore';
import { PositionsStore, PositionsStoreData } from './stores/positionsStore';
import { PriceTicksStore, PriceTicksStoreData, tickToBytes } from './stores/priceTicksStore';

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

	public getAllPositionIDsInPool(poolId: PoolID, positionIdsList: PositionID[]): Buffer[] {
		const result: Buffer[] = [];
		positionIdsList.forEach(positionId => {
			if (getPoolIDFromPositionID(positionId).equals(poolId)) {
				result.push(positionId);
			}
		});
		return result;
	}

    public async getPool (
        methodContext: ModuleEndpointContext,
        poolID: PoolID,
    ): Promise<PoolsStoreData>{
        const poolsStore = this.stores.get(PoolsStore);
		const key = await poolsStore.getKey(methodContext,[poolID]);
        return key;
    };

    public async getCurrentSqrtPrice(
		methodContext: ModuleEndpointContext,
        poolID: PoolID,
        priceDirection: boolean,
    ): Promise<Q96>{
        const pools = await this.getPool(methodContext, poolID);
        if (pools == null) {
            throw new Error();
        }
        const q96SqrtPrice = bytesToQ96(pools.sqrtPrice);
        if (priceDirection) {
            return q96SqrtPrice;
        }
        return invQ96(q96SqrtPrice);
    };

    public async getDexGlobalData (
        methodContext: ModuleEndpointContext,
    ): Promise<DexGlobalStoreData>{
        const dexGlobalStore = this.stores.get(DexGlobalStore);
        return dexGlobalStore.get(methodContext, Buffer.from([]));
    };

    public async getPosition(
		methodContext: ModuleEndpointContext,
        positionID: PositionID,
        positionIdsList: PositionID[],
    ): Promise<PositionsStoreData>{
        if (positionIdsList.includes(positionID)) {
            throw new Error();
        }
        const positionsStore = this.stores.get(PositionsStore);
        const positionStoreData = await positionsStore.get(methodContext, positionID);
        return positionStoreData;
    };
    
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
}
