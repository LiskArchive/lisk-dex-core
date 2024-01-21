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
import {
	BaseCommand,
	BaseModule,
	codec,
	FeeMethod,
	ModuleInitArgs,
	ModuleMetadata,
	PoSMethod,
	TokenMethod,
	utils,
	BlockExecuteContext,
	GenesisBlockExecuteContext,
} from 'lisk-sdk';
import { MODULE_NAME_DEX_GOVERNANCE, NUM_BYTES_POOL_ID } from '../dex/constants';
import { PoolsStore } from '../dex/stores';
import { ModuleConfig } from '../dex/types';
import { CreateProposalCommand } from './commands/createProposal';
import { DexGovernanceEndpoint } from './endpoint';
import {
	ProposalCreatedEvent,
	ProposalCreationFailedEvent,
	ProposalOutcomeCheckedEvent,
	ProposalQuorumCheckedEvent,
	ProposalVotedEvent,
} from './events';

import { DexGovernanceMethod } from './method';
import {
	getIndexStoreResponseSchema,
	getProposalRequestSchema,
	getProposalResponseSchema,
	getUserVotesRequestSchema,
	getUserVotesResponseSchema,
	proposalSchema,
	votesSchema,
	genesisDEXGovernanceSchema,
	indexStoreSchema,
} from './schemas';
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
	PROPOSAL_STATUS_ACTIVE,
	PROPOSAL_STATUS_FAILED_QUORUM,
	PROPOSAL_STATUS_FINISHED_ACCEPTED,
	QUORUM_PERCENTAGE,
	defaultConfig,
	LENGTH_PROPOSAL_ID,
} from './constants';
import { IndexStoreData } from './stores/indexStore';
import { getVoteOutcome, hasEnded } from './utils/auxiliaryFunctions';
import { DexModule } from '../dex/module';
import { VoteOnProposalCommand } from './commands/voteOnProposal';

export class DexGovernanceModule extends BaseModule {
	public id = MODULE_NAME_DEX_GOVERNANCE;
	public endpoint = new DexGovernanceEndpoint(this.stores, this.offchainStores);
	public method = new DexGovernanceMethod(this.stores, this.events);
	public _tokenMethod!: TokenMethod;
	public _posMethod!: PoSMethod;
	public _moduleConfig!: ModuleConfig;
	public _feeMethod!: FeeMethod;

	private readonly __createProposalCommand = new CreateProposalCommand(this.stores, this.events);
	private readonly __voteOnProposalCommand = new VoteOnProposalCommand(this.stores, this.events);

	public commands = [this.__createProposalCommand, this.__voteOnProposalCommand];

	public constructor() {
		super();
		this.stores.register(IndexStore, new IndexStore(this.name, 0));
		this.stores.register(ProposalsStore, new ProposalsStore(this.name, 1));
		this.stores.register(VotesStore, new VotesStore(this.name, 2));
		this.stores.register(PoolsStore, new PoolsStore(this.name, 3));
		this.events.register(ProposalCreatedEvent, new ProposalCreatedEvent(this.name));
		this.events.register(ProposalCreationFailedEvent, new ProposalCreationFailedEvent(this.name));
		this.events.register(ProposalOutcomeCheckedEvent, new ProposalOutcomeCheckedEvent(this.name));
		this.events.register(ProposalQuorumCheckedEvent, new ProposalQuorumCheckedEvent(this.name));
		this.events.register(ProposalVotedEvent, new ProposalVotedEvent(this.name));
	}

	public metadata(): ModuleMetadata {
		return {
			endpoints: [
				{
					name: this.endpoint.getProposal.name,
					request: getProposalRequestSchema,
					response: getProposalResponseSchema,
				},
				{
					name: this.endpoint.getUserVotes.name,
					request: getUserVotesRequestSchema,
					response: getUserVotesResponseSchema,
				},
				{
					name: this.endpoint.getIndexStore.name,
					response: getIndexStoreResponseSchema,
				},
			],
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
					data: indexStoreSchema,
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

	public addDependencies(tokenMethod: TokenMethod, posMethod: PoSMethod, feeMethod: FeeMethod) {
		this._tokenMethod = tokenMethod;
		this._posMethod = posMethod;
		this._feeMethod = feeMethod;

		this.__createProposalCommand.addDependencies({
			tokenMethod: this._tokenMethod,
			posMethod: this._posMethod,
			feeMethod: this._feeMethod,
		});
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	public async init(args: ModuleInitArgs) {
		const { moduleConfig } = args;
		this._moduleConfig = utils.objects.mergeDeep({}, defaultConfig, moduleConfig) as ModuleConfig;

		this.__createProposalCommand.init({
			tokenMethod: this._tokenMethod,
			posMethod: this._posMethod,
			feeMethod: this._feeMethod,
		});
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
				...votes.value,
			});
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
				if (proposal.content.poolID.length !== 0 || proposal.content.multiplier !== 0) {
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

		votesStore.forEach(votes => {
			votes.votes.voteInfos.forEach(voteInfo => {
				if (voteInfo && voteInfo.proposalIndex >= proposalsStore.length) {
					throw new Error('Vote info references incorrect proposal index');
				}
				if (voteInfo && voteInfo.decision > 2) {
					throw new Error('Incorrect vote decision');
				}
			});
		});

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

		votesStore.forEach(votes => {
			votes.votes.voteInfos.forEach(voteInfo => {
				if (
					voteInfo &&
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
		});

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
	public async beforeTransactionsExecute(context: BlockExecuteContext): Promise<void> {
		const { height } = context.header;
		const indexStore = this.stores.get(IndexStore);
		const proposalsStore = this.stores.get(ProposalsStore);
		const indexStoreData = await indexStore.get(context, Buffer.alloc(0));

		while (
			await hasEnded(
				context,
				proposalsStore,
				(
					await indexStore.get(context, Buffer.alloc(0))
				).nextQuorumCheckIndex,
				height,
				QUORUM_DURATION,
			)
		) {
			const index = indexStoreData.nextQuorumCheckIndex;
			const indexBuffer = Buffer.alloc(4);
			indexBuffer.writeUInt32BE(index, 0);

			const proposal = await proposalsStore.get(context, indexBuffer);
			const turnout = proposal.votesYes + proposal.votesNo + proposal.votesPass;

			const tokenTotalSupply = await this._tokenMethod.getTotalSupply(context);
			if (
				turnout * BigInt(1000000) <
				QUORUM_PERCENTAGE * tokenTotalSupply.totalSupply[0].totalSupply
			) {
				await proposalsStore.set(context, indexBuffer, {
					...proposal,
					status: PROPOSAL_STATUS_FAILED_QUORUM,
				});
			}

			this.events.get(ProposalQuorumCheckedEvent).add(
				context,
				{
					index,
					status: proposal.status,
				},
				[indexBuffer],
			);

			await indexStore.set(context, Buffer.alloc(0), {
				...indexStoreData,
				nextQuorumCheckIndex: indexStoreData.nextQuorumCheckIndex + 1,
			});
		}

		while (
			await hasEnded(
				context,
				proposalsStore,
				(
					await indexStore.get(context, Buffer.alloc(0))
				).nextOutcomeCheckIndex,
				height,
				VOTE_DURATION,
			)
		) {
			const index = indexStoreData.nextOutcomeCheckIndex;
			const indexBuffer = Buffer.alloc(LENGTH_PROPOSAL_ID);
			indexBuffer.writeUInt32BE(index, 0);

			const proposal = await proposalsStore.get(context, indexBuffer);

			if (proposal.status === PROPOSAL_STATUS_ACTIVE) {
				const outcome = await getVoteOutcome(
					context,
					this._tokenMethod,
					proposal.votesYes,
					proposal.votesNo,
					proposal.votesPass,
				);
				await proposalsStore.set(context, indexBuffer, {
					...proposal,
					status: outcome,
				});

				if (
					proposal.type === PROPOSAL_TYPE_INCENTIVIZATION &&
					outcome === PROPOSAL_STATUS_FINISHED_ACCEPTED
				) {
					const dexModule = new DexModule();
					await dexModule.method.updateIncentivizedPools(
						context,
						proposal.content.poolID,
						proposal.content.multiplier,
						height,
					);
				}

				this.events.get(ProposalOutcomeCheckedEvent).add(
					context,
					{
						index,
						status: outcome,
					},
					[indexBuffer],
				);
			}

			await indexStore.set(context, Buffer.alloc(0), {
				...indexStoreData,
				nextOutcomeCheckIndex: indexStoreData.nextOutcomeCheckIndex + 1,
			});
		}
	}
}
