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
import { BaseEvent, EventQueuer } from 'lisk-sdk';

export const enum PoolCreationFailedEventResult {
	POOL_CREATION_FAILED_INVALID_FEE_TIER = 1,
	POOL_CREATION_FAILED_ALREADY_EXISTS = 2,
}

export interface PoolCreationFailedEventData {
	senderAddress: Buffer;
	tokenID0: Buffer;
	tokenID1: Buffer;
	feeTier: number;
	result: PoolCreationFailedEventResult;
}

export const PoolCreationFailedEventSchema = {
	$id: '/dex/events/poolCreationFailed',
	type: 'object',
	required: ['senderAddress', 'tokenID0', 'tokenID1', 'feeTier', 'result'],
	properties: {
		senderAddress: {
			dataType: 'bytes',
			fieldNumber: 1,
		},
		tokenID0: {
			dataType: 'bytes',
			fieldNumber: 2,
		},
		tokenID1: {
			dataType: 'bytes',
			fieldNumber: 3,
		},
		feeTier: {
			dataType: 'uint32',
			fieldNumber: 4,
		},
		result: {
			dataType: 'uint32',
			fieldNumber: 5,
		},
	},
};

export class PoolCreationFailedEvent extends BaseEvent<PoolCreationFailedEventData> {
	public schema = PoolCreationFailedEventSchema;

	public log(ctx: EventQueuer, data: PoolCreationFailedEventData): void {
		this.add(ctx, data, [data.senderAddress]);
	}
}
