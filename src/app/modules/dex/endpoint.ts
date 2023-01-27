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
import {
	getAllPositionIDsInPoolRequestSchema,
	getCurrentSqrtPriceRequestSchema,
	getPoolRequestSchema,
} from './schemas';
import { PoolsStore } from './stores';
import { PoolID, PositionID, Q96, TokenID } from './types';
import { getPoolIDFromPositionID, getToken0Id, getToken1Id } from './utils/auxiliaryFunctions';
import { PoolsStoreData } from './stores/poolsStore';
import { bytesToQ96, invQ96 } from './utils/q96';
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

	public async getPool(methodContext: ModuleEndpointContext): Promise<PoolsStoreData> {
		validator.validate<{ poolId: Buffer }>(getPoolRequestSchema, methodContext.params);
		const poolsStore = this.stores.get(PoolsStore);
		const key = await poolsStore.getKey(methodContext, [methodContext.params.poolId]);
		return key;
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
