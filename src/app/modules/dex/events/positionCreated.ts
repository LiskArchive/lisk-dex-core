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
import { getPoolIDFromPositionID } from '../utils/auxiliaryFunctions';

export interface PositionCreatedEventData {
	senderAddress: Buffer;
	positionID: Buffer;
	tokenID0: Buffer;
	tokenID1: Buffer;
	amount0: bigint;
	amount1: bigint;
	tickUpper: number;
	tickLower: number;
}

export const PositionCreatedEventSchema = {
	$id: '/dex/events/positionCreated',
	type: 'object',
	required: [
		'senderAddress',
		'positionID',
		'tickLower',
		'tickUpper',
		'amount0',
		'tokenID0',
		'amount1',
		'tokenID1',
	],
	properties: {
		senderAddress: {
			dataType: 'bytes',
			fieldNumber: 1,
		},
		positionID: {
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
		amount0: {
			dataType: 'uint64',
			fieldNumber: 5,
		},
		tokenID0: {
			dataType: 'bytes',
			fieldNumber: 6,
		},
		amount1: {
			dataType: 'uint64',
			fieldNumber: 7,
		},
		tokenID1: {
			dataType: 'bytes',
			fieldNumber: 8,
		},
	},
};

export class PositionCreatedEvent extends BaseEvent<PositionCreatedEventData> {
	public schema = PositionCreatedEventSchema;

	public log(ctx: EventQueuer, data: PositionCreatedEventData): void {
		const poolID = getPoolIDFromPositionID(data.positionID);
		this.add(ctx, data, [data.senderAddress, poolID, data.positionID]);
	}
}
