/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
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

import { BaseMethod, ImmutableMethodContext, MethodContext } from 'lisk-sdk';
import { PoolsStore } from './stores';
import { PoolID, Q96 } from './types';
import { getDexGlobalData, getPool } from './utils/auxiliaryFunctions';
import { bytesToQ96, invQ96 } from './utils/q96';
import { updatePoolIncentives } from './utils/tokenEconomicsFunctions';
import { DexGlobalStore, DexGlobalStoreData } from './stores/dexGlobalStore';

export class DexMethod extends BaseMethod {
	public async poolExists(
		methodContext: ImmutableMethodContext,
		poolsStore: PoolsStore,
		poolId: PoolID,
	): Promise<boolean> {
		const result = await poolsStore.has(methodContext, poolId);
		return result;
	}

	public async addPoolCreationSettings(
		methodContext: MethodContext,
		feeTier: number,
		tickSpacing: number,
	) {
		if (feeTier > 1000000) {
			throw new Error('Fee tier can not be greater than 100%');
		}
		const settingGlobalStore = this.stores.get(DexGlobalStore);
		const settingGlobalStoreData = await settingGlobalStore.get(methodContext, Buffer.alloc(0));
		if (settingGlobalStoreData.poolCreationSettings[0].feeTier === feeTier) {
			throw new Error('Can not update fee tier');
		}
		settingGlobalStoreData.poolCreationSettings[0] = { feeTier, tickSpacing };
		await settingGlobalStore.set(methodContext, Buffer.alloc(0), settingGlobalStoreData);
	}

	public async getCurrentSqrtPrice(
		methodContext: ImmutableMethodContext,
		poolID: PoolID,
		priceDirection: boolean,
	): Promise<Q96> {
		const pools = await getPool(methodContext, this.stores, poolID);
		if (pools == null) {
			throw new Error();
		}
		const q96SqrtPrice = bytesToQ96(pools.sqrtPrice);
		if (priceDirection) {
			return q96SqrtPrice;
		}
		return invQ96(q96SqrtPrice);
	}

	public async updateIncentivizedPools(
		methodContext: MethodContext,
		poolId: PoolID,
		multiplier: number,
		currentHeight: number,
	) {
		const dexGlobalStoreData: DexGlobalStoreData = await getDexGlobalData(
			methodContext,
			this.stores,
		);

		for (const incentivizedPool of dexGlobalStoreData.incentivizedPools) {
			await updatePoolIncentives(
				methodContext,
				this.stores,
				incentivizedPool.poolId,
				currentHeight,
			);
		}
		dexGlobalStoreData.incentivizedPools.forEach((incentivizedPools, index) => {
			if (incentivizedPools.poolId.equals(poolId)) {
				dexGlobalStoreData.totalIncentivesMultiplier -= incentivizedPools.multiplier;
				dexGlobalStoreData.incentivizedPools.splice(index, 1);
			}
		});
		if (multiplier > 0) {
			dexGlobalStoreData.totalIncentivesMultiplier += multiplier;
			dexGlobalStoreData.incentivizedPools.push({ poolId, multiplier });
			dexGlobalStoreData.incentivizedPools.sort((a, b) => (a.poolId < b.poolId ? -1 : 1));
		}
		await this.stores.get(DexGlobalStore).set(methodContext, Buffer.alloc(0), dexGlobalStoreData);
	}
}
