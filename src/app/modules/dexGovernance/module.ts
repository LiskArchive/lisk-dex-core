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

import { BaseCommand, BaseModule, ModuleMetadata, PoSMethod, TokenMethod } from 'lisk-sdk';

import { DexGovernanceEndpoint } from './endpoint';
import {
	ProposalCreatedEvent,
	ProposalCreationFailedEvent,
	ProposalOutcomeCheckedEvent,
	ProposalQuorumCheckedEvent,
	ProposalVotedEvent,
} from './events';

import { DexGovernanceMethod } from './method';
import { indexSchema, proposalSchema, votesSchema } from './schemas';
import { IndexStore, ProposalsStore, VotesStore } from './stores';

export class DexGovernanceModule extends BaseModule {
	public endpoint = new DexGovernanceEndpoint(this.stores, this.offchainStores);
	public method = new DexGovernanceMethod(this.stores, this.events);
	public _tokenMethod!: TokenMethod;
	public _posMethod!: PoSMethod;

	public commands = [];

	public constructor() {
		super();
		this.stores.register(IndexStore, new IndexStore(this.name, 0));
		this.stores.register(ProposalsStore, new ProposalsStore(this.name, 1));
		this.stores.register(VotesStore, new VotesStore(this.name, 2));
		this.events.register(ProposalCreatedEvent, new ProposalCreatedEvent(this.name));
		this.events.register(ProposalCreationFailedEvent, new ProposalCreationFailedEvent(this.name));
		this.events.register(ProposalOutcomeCheckedEvent, new ProposalOutcomeCheckedEvent(this.name));
		this.events.register(ProposalQuorumCheckedEvent, new ProposalQuorumCheckedEvent(this.name));
		this.events.register(ProposalVotedEvent, new ProposalVotedEvent(this.name));
	}

	public metadata(): ModuleMetadata {
		return {
			endpoints: [],
			commands: this.commands.map((command: BaseCommand) => ({
				name: command.name,
				params: command.schema,
			})),
			events: this.events.values().map(v => ({
				name: v.name,
				data: v.schema,
			})),
			assets: [],
			stores: [
				{
					key: IndexStore.name,
					data: indexSchema,
				},
				{
					key: ProposalsStore.name,
					data: proposalSchema,
				},
				{
					key: VotesStore.name,
					data: votesSchema,
				},
			],
		};
	}

	public addDependencies(tokenMethod: TokenMethod, posMethod: PoSMethod) {
		this._tokenMethod = tokenMethod;
		this._posMethod = posMethod;
	}
}
