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

export interface SwapFailedEventData {
	senderAddress: Buffer;
	tokenIdIn: Buffer;
	tokenIdOut: Buffer;
	reason: number;
}

export const SwapFailedEventSchema = {
	$id: '/dex/events/swapFailedEvent',
	type: 'object',
	required: ['senderAddress', 'tokenIdIn', 'tokenIdOut', 'reason'],
	properties: {
		senderAddress: {
			dataType: 'bytes',
			fieldNumber: 1,
		},
		tokenIdIn: {
			dataType: 'bytes',
			fieldNumber: 2,
		},
		tokenIdOut: {
			dataType: 'bytes',
			fieldNumber: 3,
		},
		reason: {
			dataType: 'uint32',
			fieldNumber: 4,
		},
	},
};

export class SwapFailedEvent extends BaseEvent<SwapFailedEventData> {
	public schema = SwapFailedEventSchema;

	public log(ctx: EventQueuer, data: SwapFailedEventData): void {
		this.add(ctx, data, [data.senderAddress]);
	}
}
