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
import { MethodContext } from 'lisk-framework/dist-node/state_machine';
import { BaseStore, ImmutableStoreGetter, ModuleEndpointContext, StoreGetter } from 'lisk-sdk';
import { MAX_NUM_BYTES_Q96, MAX_TICK, MIN_TICK } from '../constants';

export const tickToBytes = (tickValue: number): Buffer => {
	if (tickValue > MAX_TICK || tickValue < MIN_TICK) {
		throw new Error();
	}
	const result = Buffer.alloc(4);
	result.writeUInt32BE(tickValue + 2 ** 31, 0);
	return result;
};

export const bytesToTick = (serializedTick: Buffer): number => {
	if (serializedTick.length !== 4) {
		throw new Error();
	}
	const tickValue = serializedTick.readUInt32BE(0) - 2 ** 31;
	if (tickValue > MAX_TICK || tickValue < MIN_TICK) {
		throw new Error();
	}
	return Number(tickValue);
};

export interface PriceTicksStoreData {
	liquidityNet: bigint;
	liquidityGross: bigint;
	feeGrowthOutside0: Buffer;
	feeGrowthOutside1: Buffer;
	incentivesPerLiquidityOutside: Buffer;
}

export const priceTicksStoreSchema = {
	$id: '/dex/store/priceTicksStore',
	type: 'object',
	required: [
		'liquidityNet',
		'liquidityGross',
		'feeGrowthOutside0',
		'feeGrowthOutside1',
		'incentivesPerLiquidityOutside',
	],
	properties: {
		liquidityNet: {
			dataType: 'sint64',
			fieldNumber: 1,
		},
		liquidityGross: {
			dataType: 'uint64',
			fieldNumber: 2,
		},
		feeGrowthOutside0: {
			dataType: 'bytes',
			maxLength: MAX_NUM_BYTES_Q96,
			fieldNumber: 3,
		},
		feeGrowthOutside1: {
			dataType: 'bytes',
			maxLength: MAX_NUM_BYTES_Q96,
			fieldNumber: 4,
		},
		incentivesPerLiquidityOutside: {
			dataType: 'bytes',
			maxLength: MAX_NUM_BYTES_Q96,
			fieldNumber: 5,
		},
	},
};

export class PriceTicksStore extends BaseStore<PriceTicksStoreData> {
	public schema = priceTicksStoreSchema;

	public async getKey(context: ImmutableStoreGetter, keys: Buffer[]): Promise<PriceTicksStoreData> {
		const key = Buffer.concat(keys);
		return this.get(context, key);
	}

	public async hasKey(context: StoreGetter, keys: Buffer[]): Promise<boolean> {
		const key = Buffer.concat(keys);
		return this.has(context, key);
	}

	public async setKey(
		context: StoreGetter,
		keys: Buffer[],
		value: PriceTicksStoreData,
	): Promise<void> {
		const key = Buffer.concat(keys);
		await this.set(context, key, value);
	}

	public async delKey(context: StoreGetter, keys: Buffer[]): Promise<void> {
		const key = Buffer.concat(keys);
		await this.del(context, key);
	}

	public async getAll(context: StoreGetter) {
		return this.iterate(context, {
			gte: Buffer.alloc(16, 0),
			lte: Buffer.alloc(16, 255),
			reverse: true,
		});
	}

	public async getNextTick(context: ModuleEndpointContext | MethodContext, keys: Buffer[]) {
		const key = Buffer.concat(keys);
		const keysArray: string[] = [];
		const allKeys = await this.iterate(context, {
			gte: Buffer.alloc(16, 0),
			lte: Buffer.alloc(16, 255),
			reverse: false,
		});
		allKeys.forEach(keyItem => {
			keysArray.push(keyItem.key.toString('hex'));
		});

		const currentKeyIndex = keysArray.indexOf(key.toString('hex'), 0);

		if (currentKeyIndex < keysArray.length - 1) {
			const prevKey = Buffer.from(keysArray[currentKeyIndex + 1], 'hex');
			const resKey = await this.getKey(context, [prevKey]);
			return resKey;
		}
		return null;
	}

	public async getPrevTick(context: ModuleEndpointContext | MethodContext, keys: Buffer[]) {
		const key = Buffer.concat(keys);
		const keysArray: string[] = [];
		const allKeys = await this.iterate(context, {
			gte: Buffer.alloc(16, 0),
			lte: Buffer.alloc(16, 255),
			reverse: false,
		});
		allKeys.forEach(keyItem => {
			keysArray.push(keyItem.key.toString('hex'));
		});

		const currentKeyIndex = keysArray.indexOf(key.toString('hex'), 0);

		if (currentKeyIndex > 0) {
			const prevKey = Buffer.from(keysArray[currentKeyIndex - 1], 'hex');
			const resKey = await this.getKey(context, [prevKey]);
			return resKey;
		}
		return null;
	}
}
