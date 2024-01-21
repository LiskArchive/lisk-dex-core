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

export const enum PoolCreatedEventResult {
	SUCCESSFUL = 0,
	FAIL_INSUFFICIENT_BALANCE = 1,
	FAIL_RECIPIENT_NOT_INITIALIZED = 2,
}

export interface PoolCreatedEventData {
	senderAddress: Buffer;
	poolID: Buffer;
	tokenID0: Buffer;
	tokenID1: Buffer;
	feeTier: number;
}

export const PoolCreatedEventSchema = {
	$id: '/dex/events/poolCreated',
	type: 'object',
	required: ['senderAddress', 'poolID', 'tokenID0', 'tokenID1', 'feeTier'],
	properties: {
		senderAddress: {
			dataType: 'bytes',
			fieldNumber: 1,
		},
		poolID: {
			dataType: 'bytes',
			fieldNumber: 2,
		},
		tokenID0: {
			dataType: 'bytes',
			fieldNumber: 3,
		},
		tokenID1: {
			dataType: 'bytes',
			fieldNumber: 4,
		},
		feeTier: {
			dataType: 'uint32',
			fieldNumber: 5,
		},
	},
};

export class PoolCreatedEvent extends BaseEvent<PoolCreatedEventData> {
	public schema = PoolCreatedEventSchema;

	public log(ctx: EventQueuer, data: PoolCreatedEventData): void {
		this.add(ctx, data, [data.senderAddress, data.poolID]);
	}
}
