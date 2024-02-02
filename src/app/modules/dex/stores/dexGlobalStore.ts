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
import { BaseStore } from 'lisk-sdk';
import { NUM_BYTES_POOL_ID } from '../constants';

export interface IncentivizedPools {
	poolId: Buffer;
	multiplier: number;
}

export interface PoolCreationSettings {
	feeTier: number;
	tickSpacing: number;
}

export interface DexGlobalStoreData {
	positionCounter: bigint;
	poolCreationSettings: PoolCreationSettings[];
	incentivizedPools: IncentivizedPools[];
	totalIncentivesMultiplier: number;
}

export const dexGlobalStoreSchema = {
	$id: '/dex/store/global',
	type: 'object',
	required: [
		'positionCounter',
		'poolCreationSettings',
		'incentivizedPools',
		'totalIncentivesMultiplier',
	],
	properties: {
		positionCounter: {
			dataType: 'uint64',
			fieldNumber: 1,
		},
		poolCreationSettings: {
			type: 'array',
			fieldNumber: 2,
			items: {
				type: 'object',
				required: ['feeTier', 'tickSpacing'],
				properties: {
					feeTier: {
						dataType: 'uint32',
						fieldNumber: 1,
					},
					tickSpacing: {
						dataType: 'uint32',
						fieldNumber: 2,
					},
				},
			},
		},
		incentivizedPools: {
			type: 'array',
			fieldNumber: 3,
			items: {
				type: 'object',
				required: ['poolId', 'multiplier'],
				properties: {
					poolId: {
						dataType: 'bytes',
						maxLength: NUM_BYTES_POOL_ID,
						fieldNumber: 1,
					},
					multiplier: {
						dataType: 'uint32',
						fieldNumber: 2,
					},
				},
			},
		},
		totalIncentivesMultiplier: {
			dataType: 'uint32',
			fieldNumber: 4,
		},
	},
};

export class DexGlobalStore extends BaseStore<DexGlobalStoreData> {
	public schema = dexGlobalStoreSchema;
}
