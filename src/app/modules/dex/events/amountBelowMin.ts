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

export interface AmountBelowMinEventData {
	senderAddress: Buffer;
	amount0: bigint;
	amount0Min: bigint;
	tokenID0: Buffer;
	amount1: bigint;
	amount1Min: bigint;
	tokenID1: Buffer;
}

export const AmountBelowMinEventSchema = {
	$id: '/dex/events/amountBelowMin',
	type: 'object',
	required: [
		'senderAddress',
		'amount0',
		'amount0Min',
		'tokenID0',
		'amount1',
		'amount1Min',
		'tokenID1',
	],
	properties: {
		senderAddress: {
			dataType: 'bytes',
			fieldNumber: 1,
		},
		amount0: {
			dataType: 'uint64',
			fieldNumber: 2,
		},
		amount0Min: {
			dataType: 'uint64',
			fieldNumber: 3,
		},
		tokenID0: {
			dataType: 'bytes',
			fieldNumber: 4,
		},
		amount1: {
			dataType: 'uint64',
			fieldNumber: 5,
		},
		amount1Min: {
			dataType: 'uint64',
			fieldNumber: 6,
		},
		tokenID1: {
			dataType: 'bytes',
			fieldNumber: 7,
		},
	},
};

export class AmountBelowMinEvent extends BaseEvent<AmountBelowMinEventData> {
	public schema = AmountBelowMinEventSchema;

	public log(ctx: EventQueuer, data: AmountBelowMinEventData): void {
		this.add(ctx, data, [data.senderAddress]);
	}
}
