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

export interface PositionCreationFailedEventData {
	senderAddress: Buffer;
	poolID: Buffer;
	tickLower: number;
	tickUpper: number;
	result: number;
}

export const PositionCreationFailedEventSchema = {
	$id: '/dex/events/positionCreationFailed',
	type: 'object',
	required: ['senderAddress', 'poolID', 'tickLower', 'tickUpper', 'result'],
	properties: {
		senderAddress: {
			dataType: 'bytes',
			fieldNumber: 1,
		},
		poolID: {
			dataType: 'bytes',
			fieldNumber: 2,
		},
		tickLower: {
			dataType: 'sint32',
			fieldNumber: 3,
		},
		tickUpper: {
			dataType: 'sint32',
			fieldNumber: 4,
		},
		result: {
			dataType: 'uint32',
			fieldNumber: 5,
		},
	},
};

export class PositionCreationFailedEvent extends BaseEvent<PositionCreationFailedEventData> {
	public schema = PositionCreationFailedEventSchema;

	public log(ctx: EventQueuer, data: PositionCreationFailedEventData): void {
		this.add(ctx, data, [data.senderAddress]);
	}
}
