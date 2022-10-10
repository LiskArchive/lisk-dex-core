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
import { NUM_BYTES_ADDRESS } from '../constants';

export interface SettingsStoreData {
	protocolFeeAddress: Buffer;
	protocolFeePart: number;
	validatorsLSKRewardsPart: number;
	poolCreationSettings: {
		feeTier: number;
		tickSpacing: number;
	};
}

export const settingsStoreSchema = {
	$id: '/dex/store/settings',
	type: 'object',
	required: [
		'protocolFeeAddress',
		'protocolFeePart',
		'validatorsLSKRewardsPart',
		'poolCreationSettings',
	],
	properties: {
		protocolFeeAddress: {
			dataType: 'bytes',
			length: NUM_BYTES_ADDRESS,
			fieldNumber: 1,
		},
		protocolFeePart: {
			dataType: 'uint32',
			fieldNumber: 2,
		},
		validatorsLSKRewardsPart: {
			dataType: 'uint32',
			fieldNumber: 3,
		},
		poolCreationSettings: {
			type: 'array',
			fieldNumber: 4,
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
	},
};

export class SettingsStore extends BaseStore<SettingsStoreData> {
	public schema = settingsStoreSchema;
}
