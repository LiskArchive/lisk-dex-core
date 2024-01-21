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
import { LENGTH_ADDRESS } from '../constants';

export const enum ProposalCreatedEventType {
	PROPOSAL_TYPE_UNIVERSAL,
	PROPOSAL_TYPE_INCENTIVIZATION,
}

export interface ProposalCreatedEventData {
	creator: Buffer;
	index: number;
	type: ProposalCreatedEventType;
}

export const ProposalCreatedEventSchema = {
	$id: '/dexGovernance/events/proposalCreated',
	type: 'object',
	required: ['creator', 'index', 'type'],
	properties: {
		creator: {
			dataType: 'bytes',
			minLength: LENGTH_ADDRESS,
			maxLength: LENGTH_ADDRESS,
			fieldNumber: 1,
		},
		index: {
			dataType: 'uint32',
			fieldNumber: 2,
		},
		type: {
			dataType: 'uint32',
			fieldNumber: 3,
		},
	},
};

export class ProposalCreatedEvent extends BaseEvent<ProposalCreatedEventData> {
	public schema = ProposalCreatedEventSchema;

	public log(ctx: EventQueuer, data: ProposalCreatedEventData): void {
		const indexBuffer = Buffer.alloc(4);
		indexBuffer.writeUInt32BE(data.index, 0);
		this.add(ctx, data, [indexBuffer]);
	}
}
