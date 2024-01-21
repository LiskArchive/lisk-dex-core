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

export const enum PositionUpdateFailedEventResult {
	POSITION_UPDATE_FAILED_NOT_EXISTS = 1,
	POSITION_UPDATE_FAILED_NOT_OWNER = 2,
	POSITION_UPDATE_FAILED_INSUFFICIENT_LIQUIDITY = 3,
}

export interface PositionUpdateFailedEventData {
	senderAddress: Buffer;
	positionID: Buffer;
	result: PositionUpdateFailedEventResult;
}

export const PositionUpdateFailedEventSchema = {
	$id: '/dex/events/positionUpdateFailed',
	type: 'object',
	required: ['senderAddress', 'positionID', 'result'],
	properties: {
		senderAddress: {
			dataType: 'bytes',
			fieldNumber: 1,
		},
		positionID: {
			dataType: 'bytes',
			fieldNumber: 2,
		},
		result: {
			dataType: 'uint32',
			fieldNumber: 3,
		},
	},
};

export class PositionUpdateFailedEvent extends BaseEvent<PositionUpdateFailedEventData> {
	public schema = PositionUpdateFailedEventSchema;

	public log(ctx: EventQueuer, data: PositionUpdateFailedEventData): void {
		this.add(ctx, data, [data.senderAddress, data.positionID]);
	}
}
