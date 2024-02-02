/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

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
	CommandExecuteContext,
	CommandVerifyContext,
	PoSMethod,
	VerificationResult,
	VerifyStatus,
} from 'lisk-sdk';

import { MIN_SINT32 } from '@liskhq/lisk-validator';
import { MethodContext } from 'lisk-framework/dist-node/state_machine/method_context';
import { ProposalsStore, VotesStore } from '../stores';
import { sha256 } from '../../dexRewards/constants';

import { numberToQ96, q96ToBytes } from '../../dex/utils/q96';
import { ProposalVotedEvent } from '../events';
import { LENGTH_ADDRESS, MAX_NUM_RECORDED_VOTES, PROPOSAL_STATUS_ACTIVE } from '../constants';
import { Vote, voteOnProposalParamsData } from '../types';
import { addVotes } from '../utils/auxiliaryFunctions';

export class VoteOnProposalCommand extends BaseCommand {
	private _posMethod!: PoSMethod;
	private _methodContext!: MethodContext;

	public init({ posMethod, methodContext }): void {
		this._posMethod = posMethod;
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
		const methodContext = ctx.getMethodContext();
		const votesStoreInfo: VotesStore = this.stores.get(VotesStore);
		let smallestproposalIndex = 0;
		let smallestproposalValue = MIN_SINT32;
		let previousSavedStorescheck = false;
		const senderAddress = sha256(ctx.transaction.senderPublicKey.toString()).slice(
			0,
			LENGTH_ADDRESS,
		);

		const index = ctx.params.proposalIndex;

		const stakedAmount = await this._posMethod.getLockedStakedAmount(methodContext, senderAddress);

		if (!(await votesStoreInfo.get(methodContext, senderAddress))) {
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
		const { voteInfos } = await votesStoreInfo.get(methodContext, senderAddress);

		for (let itr = 0; itr < voteInfos.length; itr += 1) {
			if (voteInfos[itr]?.proposalIndex === index) {
				addVotes(
					methodContext,
					this.stores.get(ProposalsStore),
					index,
					-voteInfos[itr]!.amount,
					voteInfos[itr]!.decision,
				);
				votesStoreInfo.setKey(methodContext, [senderAddress], newVoteInfo);
				previousSavedStorescheck = true;
			}
			if (smallestproposalValue > voteInfos[itr]!.proposalIndex) {
				smallestproposalValue = voteInfos[itr]!.proposalIndex;
				smallestproposalIndex = itr;
			}
		}

		if (
			!previousSavedStorescheck &&
			(await votesStoreInfo.get(methodContext, senderAddress)).voteInfos.length <
				MAX_NUM_RECORDED_VOTES
		) {
			(await votesStoreInfo.getKey(methodContext, [senderAddress])).voteInfos.push(
				newVoteInfo.voteInfos[0],
			);
		} else if (!previousSavedStorescheck) {
			[(await votesStoreInfo.get(methodContext, senderAddress)).voteInfos[smallestproposalIndex]] =
				newVoteInfo.voteInfos;
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
