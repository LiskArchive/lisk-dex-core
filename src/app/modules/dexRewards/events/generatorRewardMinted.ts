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

export const enum GeneratorRewardMintedEventResult {
	REWARD_REDUCTION_SEED_REVEAL,
	REWARD_REDUCTION_MAX_PREVOTES,
	REWARD_NO_REDUCTION,
}

export interface GeneratorRewardMintedEventData {
	amount: bigint;
	generatorAddress: Buffer;
	reduction: GeneratorRewardMintedEventResult;
}

export const GeneratorRewardMintedEventSchema = {
	$id: '/dexRewards/events/generatorRewardMinted',
	type: 'object',
	required: ['amount', 'reduction'],
	properties: {
		amount: {
			dataType: 'uint64',
			fieldNumber: 1,
		},
		reduction: {
			dataType: 'uint32',
			fieldNumber: 2,
		},
	},
};

export class GeneratorRewardMintedEvent extends BaseEvent<GeneratorRewardMintedEventData> {
	public schema = GeneratorRewardMintedEventSchema;

	public log(ctx: EventQueuer, data: GeneratorRewardMintedEventData): void {
		this.add(ctx, data, [data.generatorAddress]);
	}
}
