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

export interface PositionUpdatedEventData {
	senderAddress: Buffer;
	positionID: Buffer;
	amount0: bigint;
	tokenID0: Buffer;
	amount1: bigint;
	tokenID1: Buffer;
}

export const PositionUpdatedEventSchema = {
	$id: '/dex/events/positionUpdated',
	type: 'object',
	required: ['senderAddress', 'positionID', 'amount0', 'tokenID0', 'amount1', 'tokenID1'],
	properties: {
		senderAddress: {
			dataType: 'bytes',
			fieldNumber: 1,
		},
		positionID: {
			dataType: 'bytes',
			fieldNumber: 2,
		},
		amount0: {
			dataType: 'sint64',
			fieldNumber: 3,
		},
		tokenID0: {
			dataType: 'bytes',
			fieldNumber: 4,
		},
		amount1: {
			dataType: 'sint64',
			fieldNumber: 5,
		},
		tokenID1: {
			dataType: 'bytes',
			fieldNumber: 6,
		},
	},
};

export class PositionUpdatedEvent extends BaseEvent<PositionUpdatedEventData> {
	public schema = PositionUpdatedEventSchema;

	public log(ctx: EventQueuer, data: PositionUpdatedEventData): void {
		this.add(ctx, data, [data.senderAddress, data.positionID]);
	}
}
