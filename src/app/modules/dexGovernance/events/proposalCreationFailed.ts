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

export const enum ProposalCreationFailedEventReason {
	CREATION_FAILED_LIMIT_RECORDED_VOTES,
	CREATION_FAILED_NO_POOL,
}

export interface ProposalCreationFailedEventData {
	reason: ProposalCreationFailedEventReason;
}

export const ProposalCreationFailedEventSchema = {
	$id: '/dexGovernance/events/proposalCreationFailed',
	type: 'object',
	required: ['reason'],
	properties: {
		reason: {
			dataType: 'uint32',
			fieldNumber: 1,
		},
	},
};

export class ProposalCreationFailedEvent extends BaseEvent<ProposalCreationFailedEventData> {
	public schema = ProposalCreationFailedEventSchema;

	public log(ctx: EventQueuer, data: ProposalCreationFailedEventData): void {
		this.add(ctx, data);
	}
}
