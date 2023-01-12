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

import { BaseStore, StoreGetter } from 'lisk-sdk';
import { indexSchema } from '../schemas';
import { Index } from '../types';

export class IndexStore extends BaseStore<Index> {
	public schema = indexSchema;

	public async getKey(context: StoreGetter, keys: Buffer[]): Promise<Index> {
		const key = Buffer.concat(keys);
		return this.get(context, key);
	}

	public async hasKey(context: StoreGetter, keys: Buffer[]): Promise<boolean> {
		const key = Buffer.concat(keys);
		return this.has(context, key);
	}

	public async setKey(context: StoreGetter, keys: Buffer[], value: Index): Promise<void> {
		const key = Buffer.concat(keys);
		await this.set(context, key, value);
	}
}
