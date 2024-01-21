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

export const enum FeesIncentivesCollectedEventResult {
	SUCCESSFUL = 0,
	FAIL_INSUFFICIENT_BALANCE = 1,
	FAIL_RECIPIENT_NOT_INITIALIZED = 2,
}

export interface FeesIncentivesCollectedEventData {
	senderAddress: Buffer;
	positionID: Buffer;
	collectedFees0: bigint;
	tokenID0: Buffer;
	collectedFees1: bigint;
	tokenID1: Buffer;
	collectedIncentives: bigint;
	tokenIDIncentives: Buffer;
}

export const FeesIncentivesCollectedEventSchema = {
	$id: '/dex/events/feesIncentivesCollected',
	type: 'object',
	required: [
		'senderAddress',
		'positionID',
		'collectedFees0',
		'tokenID0',
		'collectedFees1',
		'tokenID1',
		'collectedIncentives',
		'tokenIDIncentives',
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
		collectedFees0: {
			dataType: 'uint64',
			fieldNumber: 3,
		},
		tokenID0: {
			dataType: 'bytes',
			fieldNumber: 4,
		},
		collectedFees1: {
			dataType: 'uint64',
			fieldNumber: 5,
		},
		tokenID1: {
			dataType: 'bytes',
			fieldNumber: 6,
		},
		collectedIncentives: {
			dataType: 'uint64',
			fieldNumber: 7,
		},
		tokenIDIncentives: {
			dataType: 'bytes',
			fieldNumber: 8,
		},
	},
};

export class FeesIncentivesCollectedEvent extends BaseEvent<FeesIncentivesCollectedEventData> {
	public schema = FeesIncentivesCollectedEventSchema;

	public log(ctx: EventQueuer, data: FeesIncentivesCollectedEventData): void {
		this.add(ctx, data, [data.senderAddress, data.positionID]);
	}
}
