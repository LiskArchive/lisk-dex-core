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

export type Address = Buffer;

export interface Proposal {
	creationHeight: number;
	votesYes: bigint;
	votesNo: bigint;
	votesPass: bigint;
	type: number;
	content: {
		text: Buffer;
		poolID: Buffer;
		multiplier: number;
		metadata: {
			title: Buffer;
			author: Buffer;
			summary: Buffer;
			discussionsTo: Buffer;
		};
	};
	status: number;
}

export interface Vote {
	address: Buffer;
	voteInfos: [
		{
			proposalIndex: number;
			decision: number;
			amount: bigint;
		},
	];
}

export interface VoteStore {
	address: Buffer;
	votes: Vote;
}

export interface GenesisDEXGovernanceData {
	proposalsStore: Proposal[];
	votesStore: VoteStore[];
}
