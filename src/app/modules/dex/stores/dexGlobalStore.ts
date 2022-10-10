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

export interface DexGlobalStoreData {
	positionCounter: bigint;
	collectableLSKFees: bigint;
}

export const dexGlobalStoreSchema = {
	$id: '',
	type: 'object',
	required: ['positionCounter', 'collectableLSKFees'],
	properties: {
		positionCounter: {
			dataType: 'uint64',
			fieldNumber: 1,
		},
		collectableLSKFees: {
			dataType: 'uint64',
			fieldNumber: 2,
		},
	},
};

export class DexGlobalStore extends BaseStore<DexGlobalStoreData> {
	public schema = dexGlobalStoreSchema;
}
