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

export interface SwappedEventData {
	senderAddress: Buffer;
	priceBefore: Buffer;
	priceAfter: Buffer;
	tokenIdIn: Buffer;
	amountIn: bigint;
	tokenIdOut: Buffer;
	amountOut: bigint;
}

export const SwappedEventSchema = {
	$id: '/dex/events/swapped',
	type: 'object',
	required: [
		'senderAddress',
		'priceBefore',
		'priceAfter',
		'tokenIdIn',
		'amountIn',
		'tokenIdOut',
		'amountOut',
	],
	properties: {
		senderAddress: {
			dataType: 'bytes',
			fieldNumber: 1,
		},
		priceBefore: {
			dataType: 'bytes',
			fieldNumber: 2,
		},
		priceAfter: {
			dataType: 'bytes',
			fieldNumber: 3,
		},
		tokenIdIn: {
			dataType: 'bytes',
			fieldNumber: 4,
		},
		amountIn: {
			dataType: 'uint64',
			fieldNumber: 5,
		},
		tokenIdOut: {
			dataType: 'bytes',
			fieldNumber: 6,
		},
		amountOut: {
			dataType: 'uint64',
			fieldNumber: 7,
		},
	},
};

export class SwappedEvent extends BaseEvent<SwappedEventData> {
	public schema = SwappedEventSchema;

	public log(ctx: EventQueuer, data: SwappedEventData): void {
		this.add(ctx, data, [data.senderAddress]);
	}
}
