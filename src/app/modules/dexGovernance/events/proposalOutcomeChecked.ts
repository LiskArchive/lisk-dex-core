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

export const enum ProposalOutcomeCheckedEventStatus {
	PROPOSAL_STATUS_ACTIVE,
	PROPOSAL_STATUS_FINISHED_ACCEPTED,
	PROPOSAL_STATUS_FINISHED_FAILED,
}

export interface ProposalOutcomeCheckedEventData {
	index: number;
	status: ProposalOutcomeCheckedEventStatus;
}

export const ProposalOutcomeCheckedEventSchema = {
	$id: '/dexGovernance/events/proposalOutcomeChecked',
	type: 'object',
	required: ['index', 'status'],
	properties: {
		index: {
			dataType: 'uint32',
			fieldNumber: 1,
		},
		status: {
			dataType: 'uint32',
			fieldNumber: 2,
		},
	},
};

export class ProposalOutcomeCheckedEvent extends BaseEvent<ProposalOutcomeCheckedEventData> {
	public schema = ProposalOutcomeCheckedEventSchema;

	public log(ctx: EventQueuer, data: ProposalOutcomeCheckedEventData): void {
		const indexBuffer = Buffer.alloc(4);
		indexBuffer.writeUInt32BE(data.index, 0);
		this.add(ctx, data, [indexBuffer]);
	}
}
