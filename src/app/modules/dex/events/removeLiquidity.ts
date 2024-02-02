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

export interface RemoveLiquidityEventData {
	senderAddress: Buffer;
	positionID: Buffer;
	amount0: bigint;
	amount1: bigint;
	tokenID0: Buffer;
	tokenID1: Buffer;
}

export const RemoveLiquidityEventSchema = {
	$id: '/dex/events/removeLiquidityEvent',
	type: 'object',
	required: ['senderAddress', 'amount0', 'amount1', 'tokenID0', 'tokenID1'],
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
			dataType: 'uint64',
			fieldNumber: 3,
		},
		amount1: {
			dataType: 'uint64',
			fieldNumber: 4,
		},
		tokenID0: {
			dataType: 'bytes',
			fieldNumber: 5,
		},
		tokenID1: {
			dataType: 'bytes',
			fieldNumber: 6,
		},
	},
};

export class RemoveLiquidityEvent extends BaseEvent<RemoveLiquidityEventData> {
	public schema = RemoveLiquidityEventSchema;

	public log(ctx: EventQueuer, data: RemoveLiquidityEventData): void {
		this.add(ctx, data, [data.senderAddress, data.positionID]);
	}
}
