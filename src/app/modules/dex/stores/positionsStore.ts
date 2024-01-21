/* eslint-disable @typescript-eslint/member-ordering */
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
import { BaseStore, StoreGetter } from 'lisk-sdk';
import { MAX_NUM_BYTES_Q96, NUM_BYTES_ADDRESS } from '../constants';

export interface PositionsStoreData {
	tickLower: number;
	tickUpper: number;
	liquidity: bigint;
	feeGrowthInsideLast0: Buffer;
	feeGrowthInsideLast1: Buffer;
	ownerAddress: Buffer;
	incentivesPerLiquidityLast: Buffer;
}

export const positionsStoreSchema = {
	$id: '/dex/store/positions',
	type: 'object',
	required: [
		'tickLower',
		'tickUpper',
		'liquidity',
		'feeGrowthInsideLast0',
		'feeGrowthInsideLast1',
		'ownerAddress',
		'incentivesPerLiquidityLast',
	],
	properties: {
		tickLower: {
			dataType: 'sint32',
			fieldNumber: 1,
		},
		tickUpper: {
			dataType: 'sint32',
			fieldNumber: 2,
		},
		liquidity: {
			dataType: 'uint64',
			fieldNumber: 3,
		},
		feeGrowthInsideLast0: {
			dataType: 'bytes',
			maxLength: MAX_NUM_BYTES_Q96,
			fieldNumber: 4,
		},
		feeGrowthInsideLast1: {
			dataType: 'bytes',
			maxLength: MAX_NUM_BYTES_Q96,
			fieldNumber: 5,
		},
		ownerAddress: {
			dataType: 'bytes',
			maxLength: NUM_BYTES_ADDRESS,
			fieldNumber: 6,
		},
		incentivesPerLiquidityLast: {
			dataType: 'bytes',
			maxLength: MAX_NUM_BYTES_Q96,
			fieldNumber: 7,
		},
	},
};

export class PositionsStore extends BaseStore<PositionsStoreData> {
	public schema = positionsStoreSchema;

	public async getKey(context: StoreGetter, keys: Buffer[]): Promise<unknown> {
		const key = Buffer.concat(keys);
		return this.get(context, key);
	}

	public async hasKey(context: StoreGetter, keys: Buffer[]): Promise<unknown> {
		const key = Buffer.concat(keys);
		return this.has(context, key);
	}

	public async setKey(context: StoreGetter, keys: Buffer[], value): Promise<void> {
		const key = Buffer.concat(keys);
		await this.set(context, key, value);
	}
}
