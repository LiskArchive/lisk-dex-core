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
import { BaseStore } from 'lisk-sdk';
import { MAX_NUM_BYTES_Q96 } from '../constants';

export interface PoolsStoreData {
	liquidity: bigint;
	sqrtPrice: Buffer;
	feeGrowthGlobal0: Buffer;
	feeGrowthGlobal1: Buffer;
	tickSpacing: number;
}

export const poolsStoreSchema = {
	$id: '/dex/store/pools',
	type: 'object',
	required: ['liquidity', 'sqrtPrice', 'feeGrowthGlobal0', 'feeGrowthGlobal1', 'tickSpacing'],
	properties: {
		liquidity: {
			dataType: 'uint64',
			fieldNumber: 1,
		},
		sqrtPrice: {
			dataType: 'bytes',
			maxLength: MAX_NUM_BYTES_Q96,
			fieldNumber: 2,
		},
		feeGrowthGlobal0: {
			dataType: 'bytes',
			maxLength: MAX_NUM_BYTES_Q96,
			fieldNumber: 3,
		},
		feeGrowthGlobal1: {
			dataType: 'bytes',
			maxLength: MAX_NUM_BYTES_Q96,
			fieldNumber: 4,
		},
		tickSpacing: {
			dataType: 'uint32',
			fieldNumber: 5,
		},
	},
};

export class PoolsStore extends BaseStore<PoolsStoreData> {
	public schema = poolsStoreSchema;

	public async getKey(context: StoreGetter, keys: Buffer[]): Promise<PoolsStoreData> {
		const key = Buffer.concat(keys);
		return this.get(context, key);
	}

	public async hasKey(context: StoreGetter, keys: Buffer[]): Promise<boolean> {
		const key = Buffer.concat(keys);
		return this.has(context, key);
	}

	public async setKey(context: StoreGetter, keys: Buffer[], value: PoolsStoreData): Promise<void> {
		const key = Buffer.concat(keys);
		await this.set(context, key, value);
	}
}
