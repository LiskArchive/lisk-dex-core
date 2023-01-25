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

import { BaseEvent } from 'lisk-sdk';

import { DexGovernanceModule } from '../../../../src/app/modules/dexGovernance/module';

import {
	ProposalCreatedEvent,
	ProposalCreationFailedEvent,
	ProposalOutcomeCheckedEvent,
	ProposalQuorumCheckedEvent,
	ProposalVotedEvent,
} from '../../../../src/app/modules/dexGovernance/events';

describe('DexGovernanceModule:events', () => {
	let dexGovernanceModule: DexGovernanceModule;

	beforeAll(() => {
		dexGovernanceModule = new DexGovernanceModule();
	});

	it('events should be registered and inherit from BaseEvent', () => {
		expect(dexGovernanceModule.events.get(ProposalCreatedEvent)).toBeInstanceOf(BaseEvent);
		expect(dexGovernanceModule.events.get(ProposalCreationFailedEvent)).toBeInstanceOf(BaseEvent);
		expect(dexGovernanceModule.events.get(ProposalOutcomeCheckedEvent)).toBeInstanceOf(BaseEvent);
		expect(dexGovernanceModule.events.get(ProposalQuorumCheckedEvent)).toBeInstanceOf(BaseEvent);
		expect(dexGovernanceModule.events.get(ProposalVotedEvent)).toBeInstanceOf(BaseEvent);
	});
});