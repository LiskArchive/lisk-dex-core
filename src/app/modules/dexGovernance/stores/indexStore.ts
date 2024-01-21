/* eslint-disable @typescript-eslint/member-ordering */
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
import { indexStoreSchema } from '../schemas';

export interface IndexStoreData {
	newestIndex: number;
	nextOutcomeCheckIndex: number;
	nextQuorumCheckIndex: number;
}

export class IndexStore extends BaseStore<IndexStoreData> {
	public schema = indexStoreSchema;

	public async getKey(context: StoreGetter, keys: Buffer[]): Promise<IndexStoreData> {
		const key = Buffer.concat(keys);
		return this.get(context, key);
	}

	public async hasKey(context: StoreGetter, keys: Buffer[]): Promise<boolean> {
		const key = Buffer.concat(keys);
		return this.has(context, key);
	}

	public async setKey(context: StoreGetter, keys: Buffer[], value: IndexStoreData): Promise<void> {
		const key = Buffer.concat(keys);
		await this.set(context, key, value);
	}
}
