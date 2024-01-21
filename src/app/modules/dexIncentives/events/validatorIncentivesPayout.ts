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

export interface ValidatorIncentivesPayoutEventData {
	validatorAddress: Buffer;
	amount: bigint;
}

export const validatorIncentivesPayoutSchema = {
	$id: '/dex/events/validatorIncentivesPayout',
	type: 'object',
	required: ['amount'],
	properties: {
		amount: {
			dataType: 'uint64',
			fieldNumber: 1,
		},
	},
};

export class ValidatorIncentivesPayout extends BaseEvent<ValidatorIncentivesPayoutEventData> {
	public schema = validatorIncentivesPayoutSchema;

	public log(ctx: EventQueuer, data: ValidatorIncentivesPayoutEventData): void {
		this.add(ctx, data, [data.validatorAddress]);
	}
}
