/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

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

import {
	BaseCommand,
	CommandExecuteContext,
	CommandVerifyContext,
	VerificationResult,
	VerifyStatus,
} from 'lisk-sdk';

import { PoSEndpoint } from 'lisk-framework/dist-node/modules/pos/endpoint';
import { PrefixedStateReadWriter } from 'lisk-framework/dist-node/state_machine/prefixed_state_read_writer';
import {
	createTransientModuleEndpointContext,
	InMemoryPrefixedStateDB,
} from 'lisk-framework/dist-node/testing';
import { MIN_SINT32 } from '@liskhq/lisk-validator';
import { MethodContext } from 'lisk-framework/dist-node/state_machine/method_context';
import { ProposalsStore, VotesStore } from '../stores';
import { sha256 } from '../../dexRewards/constants';

import { numberToQ96, q96ToBytes } from '../../dex/utils/q96';
import { ProposalVotedEvent } from '../events';
import {
	COMMAND_VOTE_ON_Proposal,
	LENGTH_ADDRESS,
	MAX_NUM_RECORDED_VOTES,
	PROPOSAL_STATUS_ACTIVE,
} from '../constants';
import { Vote, voteOnProposalParamsData } from '../types';
import { addVotes } from '../utils/auxiliaryFunctions';

export class VoteOnProposalCommand extends BaseCommand {
	public id = COMMAND_VOTE_ON_Proposal;
	private _posEndpoint!: PoSEndpoint;
	private _methodContext!: MethodContext;

	public init({ posEndpoint, methodContext }): void {
		this._posEndpoint = posEndpoint;
		this._methodContext = methodContext;
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	public async verify(
		ctx: CommandVerifyContext<voteOnProposalParamsData>,
	): Promise<VerificationResult> {
		const proposalStoreInfo = this.stores.get(ProposalsStore);

		const result = Buffer.alloc(4);
		result.writeUInt32BE(ctx.params.proposalIndex, 0);
		const proposalsStoreDate = await proposalStoreInfo.get(this._methodContext, result);

		if (!proposalsStoreDate) {
			return {
				status: VerifyStatus.FAIL,
				error: new Error('Proposal does not exist'),
			};
		}
		if (ctx.params.decision > 2) {
			return {
				status: VerifyStatus.FAIL,
				error: new Error('Decision does not exist'),
			};
		}
		if (
			(await proposalStoreInfo.get(this._methodContext, result)).status !== PROPOSAL_STATUS_ACTIVE
		) {
			return {
				status: VerifyStatus.FAIL,
				error: new Error('Proposal does not exist'),
			};
		}
		return {
			status: VerifyStatus.OK,
		};
	}

	public async execute(ctx: CommandExecuteContext<voteOnProposalParamsData>): Promise<void> {
		const stateStore = new PrefixedStateReadWriter(new InMemoryPrefixedStateDB());
		const methodContext = ctx.getMethodContext();
		const votesStoreInfo: VotesStore = this.stores.get(VotesStore);
		let smallestproposalIndex = 0;
		let smallestproposalValue = MIN_SINT32;
		let previousSavedStorescheck = false;
		const senderAddress = sha256(ctx.transaction.senderPublicKey.toString()).slice(
			0,
			LENGTH_ADDRESS,
		);

		const moduleEndpointContext = createTransientModuleEndpointContext({
			stateStore,
			params: { address: senderAddress },
		});

		const index = ctx.params.proposalIndex;

		const stakedAmount = (await this._posEndpoint.getLockedStakedAmount(moduleEndpointContext))
			.amount;

		try {
			await votesStoreInfo.get(methodContext, senderAddress);
		} catch (error) {
			votesStoreInfo.set(methodContext, senderAddress, { voteInfos: [] });
		}
		const newVoteInfo: Vote = {
			voteInfos: [
				{
					proposalIndex: index,
					decision: ctx.params.decision,
					amount: BigInt(stakedAmount),
				},
			],
		};
		const voteStore = await votesStoreInfo.get(methodContext, senderAddress);
		const voteStoreInfos = voteStore.voteInfos;

		for (let itr = 0; itr < voteStoreInfos.length; itr += 1) {
			if (voteStoreInfos[itr]?.proposalIndex === index) {
				addVotes(
					methodContext,
					this.stores.get(ProposalsStore),
					index,
					-voteStoreInfos[itr]!.amount,
					voteStoreInfos[itr]!.decision,
				);
				[voteStoreInfos[itr]] = newVoteInfo.voteInfos;
				await votesStoreInfo.set(methodContext, senderAddress, voteStore);
				previousSavedStorescheck = true;
			}
			if (smallestproposalValue > voteStoreInfos[itr]!.proposalIndex) {
				smallestproposalValue = voteStoreInfos[itr]!.proposalIndex;
				smallestproposalIndex = itr;
			}
		}

		if (!previousSavedStorescheck && voteStoreInfos.length < MAX_NUM_RECORDED_VOTES) {
			voteStoreInfos.push(newVoteInfo.voteInfos[0]);
			await votesStoreInfo.set(methodContext, senderAddress, voteStore);
		} else if (!previousSavedStorescheck) {
			[voteStoreInfos[smallestproposalIndex]] = newVoteInfo.voteInfos;
		}
		addVotes(
			methodContext,
			this.stores.get(ProposalsStore),
			index,
			BigInt(stakedAmount),
			ctx.params.decision,
		);

		this.events.get(ProposalVotedEvent).add(
			methodContext,
			{
				index,
				voterAddress: senderAddress,
				decision: ctx.params.decision,
				amount: BigInt(stakedAmount),
			},
			[senderAddress, q96ToBytes(numberToQ96(BigInt(index)))],
			true,
		);
	}
}
