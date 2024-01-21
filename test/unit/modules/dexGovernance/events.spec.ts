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

	it('ProposalCreatedEvent schema property types should be as such', () => {
		expect(
			dexGovernanceModule.events.get(ProposalCreatedEvent).schema.properties.creator.dataType,
		).toBe('bytes');
		expect(
			dexGovernanceModule.events.get(ProposalCreatedEvent).schema.properties.index.dataType,
		).toBe('uint32');
	});

	it('ProposalCreationFailedEvent schema property types should be as such', () => {
		expect(
			dexGovernanceModule.events.get(ProposalCreationFailedEvent).schema.properties.reason.dataType,
		).toBe('uint32');
	});

	it('ProposalOutcomeCheckedEvent schema property types should be as such', () => {
		expect(
			dexGovernanceModule.events.get(ProposalOutcomeCheckedEvent).schema.properties.index.dataType,
		).toBe('uint32');
		expect(
			dexGovernanceModule.events.get(ProposalOutcomeCheckedEvent).schema.properties.status.dataType,
		).toBe('uint32');
	});

	it('ProposalQuorumCheckedEvent schema property types should be as such', () => {
		expect(
			dexGovernanceModule.events.get(ProposalQuorumCheckedEvent).schema.properties.index.dataType,
		).toBe('uint32');
		expect(
			dexGovernanceModule.events.get(ProposalQuorumCheckedEvent).schema.properties.status.dataType,
		).toBe('uint32');
	});

	it('ProposalVotedEvent schema property types should be as such', () => {
		expect(
			dexGovernanceModule.events.get(ProposalVotedEvent).schema.properties.amount.dataType,
		).toBe('uint64');
		expect(
			dexGovernanceModule.events.get(ProposalVotedEvent).schema.properties.decision.dataType,
		).toBe('uint32');
		expect(
			dexGovernanceModule.events.get(ProposalVotedEvent).schema.properties.index.dataType,
		).toBe('uint32');
		expect(
			dexGovernanceModule.events.get(ProposalVotedEvent).schema.properties.voterAddress.dataType,
		).toBe('bytes');
	});
});
