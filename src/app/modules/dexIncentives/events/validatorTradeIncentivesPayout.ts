/*
 * Copyright © 2022 Lisk Foundation
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

export interface ValidatorTradeIncentivesPayoutEventData {
	validatorAddress: Buffer;
	amount: bigint;
}

export const ValidatorTradeIncentivesPayoutEventSchema = {
	$id: '/dex/events/validatorTradeIncentivesPayout',
	type: 'object',
	required: ['amount'],
	properties: {
		amount: {
			dataType: 'uint64',
			fieldNumber: 1,
		},
	},
};

export class validatorIncentivesPayout extends BaseEvent<ValidatorTradeIncentivesPayoutEventData> {
	public schema = ValidatorTradeIncentivesPayoutEventSchema;

	public log(ctx: EventQueuer, data: ValidatorTradeIncentivesPayoutEventData): void {
		this.add(ctx, data, [data.validatorAddress]);
	}
}
