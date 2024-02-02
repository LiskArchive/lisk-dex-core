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

import { NamedRegistry } from 'lisk-framework/dist-node/modules/named_registry';
import { MethodContext, TokenMethod } from 'lisk-sdk';
import {
	DECISION_YES,
	DECISION_NO,
	DECISION_PASS,
	PROPOSAL_STATUS_FINISHED_ACCEPTED,
	PROPOSAL_STATUS_FINISHED_FAILED,
} from '../constants';
import { ProposalCreationFailedEvent } from '../events';
import { ProposalsStore } from '../stores';

export const getVoteOutcome = async (
	methodContext: MethodContext,
	tokenMethod: TokenMethod,
	amountYes: bigint,
	amountNo: bigint,
	amountPass: bigint,
) => {
	const electorate = await tokenMethod.getTotalSupply(methodContext);
	const turnout = amountYes + amountNo + amountPass;
	if (
		amountYes * amountYes * turnout >
		amountNo * amountNo * electorate.totalSupply[0].totalSupply
	) {
		return PROPOSAL_STATUS_FINISHED_ACCEPTED;
	}
	return PROPOSAL_STATUS_FINISHED_FAILED;
};

export const hasEnded = async (
	methodContext: MethodContext,
	proposalsStore: ProposalsStore,
	index: number,
	currentHeight: number,
	duration: number,
): Promise<boolean> => {
	if (index < 0) {
		return true;
	}

	const indexBuffer = Buffer.alloc(4);
	indexBuffer.writeUInt32BE(index, 0);

	if (!(await proposalsStore.has(methodContext, indexBuffer))) {
		return false;
	}
	const proposal = await proposalsStore.get(methodContext, indexBuffer);
	return currentHeight - proposal.creationHeight >= duration;
};

export const checkNonNegative = (number: bigint) => {
	if (number < 0) {
		throw new Error('Given number must be non-negative');
	}
};

export const addVotes = async (
	methodContext: MethodContext,
	proposalsStore: ProposalsStore,
	index: number,
	votes: bigint,
	decision: number,
) => {
	const indexBuffer = Buffer.alloc(4);
	indexBuffer.writeUInt32BE(index, 0);

	const proposal = await proposalsStore.get(methodContext, indexBuffer);
	if (decision === DECISION_YES) {
		const votesYes = votes + proposal.votesYes;
		checkNonNegative(votesYes);
		proposal.votesYes = votesYes;
	} else if (decision === DECISION_NO) {
		const votesNo = votes + proposal.votesNo;
		checkNonNegative(votesNo);
		proposal.votesNo = votesNo;
	} else if (decision === DECISION_PASS) {
		const votesPass = votes + proposal.votesPass;
		checkNonNegative(votesPass);
		proposal.votesPass = votesPass;
	} else {
		throw new Error('Decision does not exist');
	}
	await proposalsStore.set(methodContext, indexBuffer, proposal);
};

export const emitProposalCreationFailedEvent = (
	methodContext: MethodContext,
	reason: number,
	events: NamedRegistry,
) => {
	events.get(ProposalCreationFailedEvent).add(
		methodContext,
		{
			reason,
		},
		[],
		true,
	);
};
