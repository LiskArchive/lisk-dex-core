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
import { LENGTH_ADDRESS } from '../constants';

export const enum ProposalVotedEventDecision {
	DECISION_YES,
	DECISION_NO,
	DECISION_PASS,
}

export interface ProposalVotedEventData {
	index: number;
	voterAddress: Buffer;
	decision: ProposalVotedEventDecision;
	amount: bigint;
}

export const ProposalVotedEventSchema = {
	$id: '/dexGovernance/events/proposalVoted',
	type: 'object',
	required: ['index', 'voterAddress', 'decision', 'amount'],
	properties: {
		index: {
			dataType: 'uint32',
			fieldNumber: 1,
		},
		voterAddress: {
			dataType: 'bytes',
			maxLength: LENGTH_ADDRESS,
			fieldNumber: 2,
		},
		decision: {
			dataType: 'uint32',
			fieldNumber: 3,
		},
		amount: {
			dataType: 'uint64',
			fieldNumber: 4,
		},
	},
};

export class ProposalVotedEvent extends BaseEvent<ProposalVotedEventData> {
	public schema = ProposalVotedEventSchema;

	public log(ctx: EventQueuer, data: ProposalVotedEventData): void {
		const indexBuffer = Buffer.alloc(4);
		indexBuffer.writeUInt32BE(data.index, 0);
		this.add(ctx, data, [data.voterAddress, indexBuffer]);
	}
}
