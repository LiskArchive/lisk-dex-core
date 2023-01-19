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
import { codec } from '@liskhq/lisk-codec';

import {
	BaseCommand,
	BaseModule,
	GenesisBlockExecuteContext,
	ModuleMetadata,
	PoSMethod,
	TokenMethod,
} from 'lisk-sdk';
import { NUM_BYTES_POOL_ID } from '../dex/constants';

import { DexGovernanceEndpoint } from './endpoint';
import {
	ProposalCreatedEvent,
	ProposalCreationFailedEvent,
	ProposalOutcomeCheckedEvent,
	ProposalQuorumCheckedEvent,
	ProposalVotedEvent,
} from './events';

import { DexGovernanceMethod } from './method';
import { genesisDEXGovernanceSchema } from './schemas';
import { IndexStore, ProposalsStore, VotesStore } from './stores';
import { Proposal, Vote, GenesisDEXGovernanceData } from './types';
import {
	PROPOSAL_TYPE_INCENTIVIZATION,
	PROPOSAL_TYPE_UNIVERSAL,
	MAX_NUM_RECORDED_VOTES,
	DECISION_YES,
	DECISION_NO,
	DECISION_PASS,
	VOTE_DURATION,
	QUORUM_DURATION,
} from './constants';

export class DexGovernanceModule extends BaseModule {
	public endpoint = new DexGovernanceEndpoint(this.stores, this.offchainStores);
	public method = new DexGovernanceMethod(this.stores, this.events);
	public _tokenMethod!: TokenMethod;
	public _posMethod!: PoSMethod;

	public commands = [];

	public constructor() {
		super();
		this.stores.register(IndexStore, new IndexStore(this.name));
		this.stores.register(ProposalsStore, new ProposalsStore(this.name));
		this.stores.register(VotesStore, new VotesStore(this.name));
		this.events.register(ProposalCreatedEvent, new ProposalCreatedEvent(this.name));
		this.events.register(ProposalCreationFailedEvent, new ProposalCreationFailedEvent(this.name));
		this.events.register(ProposalOutcomeCheckedEvent, new ProposalOutcomeCheckedEvent(this.name));
		this.events.register(ProposalQuorumCheckedEvent, new ProposalQuorumCheckedEvent(this.name));
		this.events.register(ProposalVotedEvent, new ProposalVotedEvent(this.name));
	}

	public metadata(): ModuleMetadata {
		return {
			name: this.name,
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
		};
	}

	public addDependencies(tokenMethod: TokenMethod, posMethod: PoSMethod) {
		this._tokenMethod = tokenMethod;
		this._posMethod = posMethod;
	}

	public hasEnded(
		index: number,
		currentHeight: number,
		duration: Number,
		context: GenesisBlockExecuteContext,
	) {
		if (index < 0) return true;
		const assetBytes = context.assets.getAsset(this.name);
		if (!assetBytes) {
			return;
		}
		const genesisData = codec.decode<GenesisDEXGovernanceData>(
			genesisDEXGovernanceSchema,
			assetBytes,
		);
		const proposalsStore: Proposal[] = genesisData.proposalsStore;
		if (!proposalsStore[index]) return false;
		return currentHeight - proposalsStore[index].creationHeight >= duration;
	}

	public async initGenesisState(context: GenesisBlockExecuteContext) {
		this.verifyGenesisBlock(context);

		// const proposalsStore: Proposal[] = genesisData.proposalsStore;
		// const votesStore: Vote[] = genesisData.votesStore;
		const proposalsStore = this.stores.get(ProposalsStore);
		const indexStore: IndexStore = this.stores.get(IndexStore);
		const height = context.header.height;

		// initialize proposals subsotre and compute values for index substore
		for (const [index, proposal] of proposalsStore.entries()) {
			proposalsStore[index] = {
				creationHeight: proposal.creationHeight,
				votesYes: proposal.votesYes,
				votesNo: proposal.votesNo,
				votesPass: proposal.votesPass,
				type: proposal.type,
				content: proposal.content,
				status: proposal.status,
			};
		}

		// initialize votes substore
		for (const [voteId, votes] of votesStore.entries()) {
			votesStore[voteId] = {
				...votes,
			};
		}

		// initialize index substore
		let nextoutcomeCheckIndex = 0;
		let nextQuorumCheckIndex = 0;
		const newestIndex = ProposalsStore.length - 1;
		for (let i = 0; i < proposalsStore.length; i++) {
			// proposals substore is already initialized
			if (!this.hasEnded(i, height, VOTE_DURATION, context)) {
				nextoutcomeCheckIndex = i;
				break;
			}
		}

		for (let i = 0; i < proposalsStore.length; i++) {
			if (!this.hasEnded(i, height, QUORUM_DURATION, context)) {
				nextQuorumCheckIndex = i;
				break;
			}
		}

		const indexStoreData = {
			newestIndex: newestIndex,
			nextOutcomeCheckIndex: nextoutcomeCheckIndex,
			nextQuorumCheckIndex: nextQuorumCheckIndex,
		};

		await indexStore.set(context, Buffer.alloc(0), indexStoreData);
	}

	public verifyGenesisBlock(context: GenesisBlockExecuteContext) {
		const assetBytes = context.assets.getAsset(this.name);
		if (!assetBytes) {
			return;
		}
		const genesisData = codec.decode<GenesisDEXGovernanceData>(
			genesisDEXGovernanceSchema,
			assetBytes,
		);
		const proposalsStore: Proposal[] = genesisData.proposalsStore;
		const votesStore: Vote[] = genesisData.votesStore;
		const height: Number = context.header.height;

		// creation heights can not decrease in the array
		let previousCreationHeight = 0;
		for (let i = 0; i < proposalsStore.length; i += 1) {
			if (proposalsStore[i].creationHeight < previousCreationHeight) {
				throw new Error('Proposals must be indexed in the creation order');
			}
			previousCreationHeight = proposalsStore[i].creationHeight;
		}
		for (let i = 0; i < proposalsStore.length; i += 1) {
			if (proposalsStore[i].creationHeight >= height) {
				throw new Error('Proposal can not be created in the future');
			}
			if (proposalsStore[i].type > 1) {
				throw new Error('Invalid proposal type');
			}
			if (
				proposalsStore[i].type === PROPOSAL_TYPE_INCENTIVIZATION &&
				proposalsStore[i].content.poolID.length !== NUM_BYTES_POOL_ID
			) {
				throw new Error('Incentivization proposal must contain a valid pool ID');
			}
			if (proposalsStore[i].type === PROPOSAL_TYPE_UNIVERSAL) {
				if (proposalsStore[i].content.text.length === 0) {
					throw new Error('Proposal text can not be empty for universal proposal');
				}
				if (
					proposalsStore[i].content.poolID.length !== 0 ||
					proposalsStore[i].content.multiplier !== 0
				) {
					throw new Error(
						'For universal proposals, pool ID must be empty and multiplier must be set to 0',
					);
				}
			}
			if (proposalsStore[i].status > 3) {
				throw new Error('Invalid proposal status');
			}
		}

		// checks for votesStore
		for (let i = 0; i < votesStore.length; i += 1) {
			const exist = votesStore.find(votes => {
				if (votes.address === votesStore[i].address) {
					return true;
				}
				return false;
			});
			if (exist) {
				throw new Error('All addresses in votes store must be unique');
			}
		}

		votesStore.forEach((votes) => {
			votes.voteInfos.forEach(voteInfo => {
				if (voteInfo.proposalIndex >= proposalsStore.length) {
					throw new Error('Vote info references incorrect proposal index');
				}
				if (voteInfo.decision > 2) {
					throw new Error('Incorrect vote decision');
				}
			});
		})

		// check vote calculation for the proposals with recorded votes
		const firstWithRecordedVotes = Math.max(0, proposalsStore.length - MAX_NUM_RECORDED_VOTES);
		const votesYes = {};
		const votesNo = {};
		const votesPass = {};

		for (let index = firstWithRecordedVotes; index < proposalsStore.length; index += 1) {
			votesYes[index] = BigInt(0);
			votesNo[index] = BigInt(0);
			votesPass[index] = BigInt(0);
		}

		votesStore.forEach((votes) => {
			votes.voteInfos.forEach(voteInfo => {
				if (
					voteInfo.proposalIndex >= firstWithRecordedVotes &&
					voteInfo.proposalIndex < proposalsStore.length
				) {
					const index = voteInfo.proposalIndex;
					const decision = voteInfo.decision;
					const amount = voteInfo.amount;
					switch (decision) {
						case DECISION_YES:
							votesYes[index] += amount;
							break;
						case DECISION_NO:
							votesNo[index] += amount;
							break;
						case DECISION_PASS:
							votesPass[index] += amount;
							break;
						default:
							break;
					}
				}
			});
		})

		for (let index = firstWithRecordedVotes; index < proposalsStore.length; index += 1) {
			if (
				proposalsStore[index].votesYes !== votesYes[index] ||
				proposalsStore[index].votesNo !== votesNo[index] ||
				proposalsStore[index].votesPass !== votesPass[index]
			) {
				throw new Error('Incorrect vote data about the proposals with recorded votes');
			}
		}
	}
}
