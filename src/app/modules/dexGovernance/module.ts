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
	PoSMethod,
	TokenMethod,
} from 'lisk-sdk';
import { RootModuleMetadata } from 'lisk-framework/dist-node/modules/base_module';
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
import { GenesisDEXGovernanceData } from './types';
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
import { IndexStoreData } from './stores/indexStore';

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

	public metadata(): RootModuleMetadata {
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
			assets: []
		};
	}

	public addDependencies(tokenMethod: TokenMethod, posMethod: PoSMethod) {
		this._tokenMethod = tokenMethod;
		this._posMethod = posMethod;
	}

	public hasEnded(
		index: number,
		currentHeight: number,
		duration: number,
		context: GenesisBlockExecuteContext,
	) {
		if (index < 0) return true;
		const assetBytes = context.assets.getAsset(this.name);
		if (!assetBytes) {
			return false;
		}
		const genesisData = codec.decode<GenesisDEXGovernanceData>(
			genesisDEXGovernanceSchema,
			assetBytes,
		);
		const { proposalsStore } = genesisData;
		if (!proposalsStore[index]) return false;
		return currentHeight - proposalsStore[index].creationHeight >= duration;
	}

	public async initGenesisState(context: GenesisBlockExecuteContext) {
		this.verifyGenesisBlock(context);

		const proposalsStore = this.stores.get(ProposalsStore);
		const votesStore = this.stores.get(VotesStore);
		const proposalsData = await proposalsStore.getAll(context);
		const votesData = await votesStore.getAll(context);
		const indexStore: IndexStore = this.stores.get(IndexStore);
		const { height } = context.header;

		// initialize proposals subsotre and compute values for index substore
		for (const [index, proposal] of proposalsData.entries()) {
			await proposalsStore.set(context, Buffer.alloc(index), {
				creationHeight: proposal.value.creationHeight,
				votesYes: proposal.value.votesYes,
				votesNo: proposal.value.votesNo,
				votesPass: proposal.value.votesPass,
				type: proposal.value.type,
				content: proposal.value.content,
				status: proposal.value.status,
			});
		}

		// initialize votes substore
		for (const [voteId, votes] of votesData.entries()) {
			await votesStore.set(context, Buffer.alloc(voteId), {
				...votes.value
			})
		}

		// initialize index substore
		let nextoutcomeCheckIndex = 0;
		let nextQuorumCheckIndex = 0;
		const newestIndex = proposalsData.length - 1;
		for (let i = 0; i < proposalsData.length; i += 1) {
			// proposals substore is already initialized
			if (!this.hasEnded(i, height, VOTE_DURATION, context)) {
				nextoutcomeCheckIndex = i;
				break;
			}
		}

		for (let i = 0; i < proposalsData.length; i += 1) {
			if (!this.hasEnded(i, height, QUORUM_DURATION, context)) {
				nextQuorumCheckIndex = i;
				break;
			}
		}

		const indexStoreData: IndexStoreData = {
			newestIndex,
			nextOutcomeCheckIndex: nextoutcomeCheckIndex,
			nextQuorumCheckIndex,
		};

		await indexStore.set(context, Buffer.from([]), indexStoreData);
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
		const { proposalsStore, votesStore } = genesisData;
		const { height } = context.header;

		// creation heights can not decrease in the array
		let previousCreationHeight = 0;
		for (const proposal of proposalsStore) {
			if (proposal.creationHeight < previousCreationHeight) {
				throw new Error('Proposals must be indexed in the creation order');
			}
			previousCreationHeight = proposal.creationHeight;
		}
		for (const proposal of proposalsStore) {
			if (proposal.creationHeight >= height) {
				throw new Error('Proposal can not be created in the future');
			}
			if (proposal.type > 1) {
				throw new Error('Invalid proposal type');
			}
			if (
				proposal.type === PROPOSAL_TYPE_INCENTIVIZATION &&
				proposal.content.poolID.length !== NUM_BYTES_POOL_ID
			) {
				throw new Error('Incentivization proposal must contain a valid pool ID');
			}
			if (proposal.type === PROPOSAL_TYPE_UNIVERSAL) {
				if (proposal.content.text.length === 0) {
					throw new Error('Proposal text can not be empty for universal proposal');
				}
				if (
					proposal.content.poolID.length !== 0 ||
					proposal.content.multiplier !== 0
				) {
					throw new Error(
						'For universal proposals, pool ID must be empty and multiplier must be set to 0',
					);
				}
			}
			if (proposal.status > 3) {
				throw new Error('Invalid proposal status');
			}
		}

		// checks for votesStore
		for (const vote of votesStore) {
			const exist = votesStore.find(votes => {
				if (votes.address === vote.address) {
					return true;
				}
				return false;
			});
			if (!exist) {
				throw new Error('All addresses in votes store must be unique');
			}
		}

		votesStore.forEach((votes) => {
			votes.votes.voteInfos.forEach(voteInfo => {
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
			votes.votes.voteInfos.forEach(voteInfo => {
				if (
					voteInfo.proposalIndex >= firstWithRecordedVotes &&
					voteInfo.proposalIndex < proposalsStore.length
				) {
					const index = voteInfo.proposalIndex;
					const { decision, amount } = voteInfo;
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
