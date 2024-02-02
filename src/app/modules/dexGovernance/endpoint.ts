/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
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

import { validator } from '@liskhq/lisk-validator';
import { BaseEndpoint, ModuleEndpointContext } from 'lisk-framework';
import { Index, Proposal, Vote } from './types';
import { IndexStore, ProposalsStore, VotesStore } from './stores';
import { getProposalRequestSchema, getUserVotesRequestSchema } from './schemas';

export class DexGovernanceEndpoint extends BaseEndpoint {
	public async getProposal(context: ModuleEndpointContext): Promise<{ proposal: Proposal }> {
		validator.validate<{ proposal: number }>(getProposalRequestSchema, context.params);
		const proposalsStore = this.stores.get(ProposalsStore);

		const index = Buffer.alloc(4);
		index.writeUInt32BE(context.params.proposal, 0);

		if (!(await proposalsStore.has(context, index))) {
			throw new Error('Proposal with the given index does not exist');
		}

		const proposal = await proposalsStore.get(context, index);

		return { proposal };
	}

	public async getUserVotes(context: ModuleEndpointContext): Promise<Vote> {
		validator.validate<{ voterAddress: string }>(getUserVotesRequestSchema, context.params);

		const votesStore = this.stores.get(VotesStore);

		const voterAddress = Buffer.from(context.params.voterAddress, 'hex');

		if (!(await votesStore.has(context, voterAddress))) {
			return {} as Vote;
		}

		const votesByAddress = await votesStore.get(context, voterAddress);

		return votesByAddress;
	}

	public async getIndexStore(context: ModuleEndpointContext): Promise<{ indexStore: Index }> {
		const indexStore = this.stores.get(IndexStore);

		const index = Buffer.alloc(0);

		if (!(await indexStore.has(context, index))) {
			throw new Error('Index store does not exist');
		}

		const indexStoreData = await indexStore.get(context, index);

		return { indexStore: indexStoreData };
	}
}
