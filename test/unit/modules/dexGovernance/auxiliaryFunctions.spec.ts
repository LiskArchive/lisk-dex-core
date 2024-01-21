/* eslint-disable import/no-cycle */
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

import { MethodContext, TokenMethod, testing } from 'lisk-framework';
import { PrefixedStateReadWriter } from 'lisk-framework/dist-node/state_machine/prefixed_state_read_writer';
import { createMethodContext, EventQueue } from 'lisk-framework/dist-node/state_machine';

import { PoolID } from '../../../../src/app/modules/dex/types';
import { DexGovernanceModule } from '../../../../src/app/modules';
import { Proposal } from '../../../../src/app/modules/dexGovernance/types';
import {
	DECISION_YES,
	PROPOSAL_STATUS_ACTIVE,
	PROPOSAL_STATUS_FINISHED_FAILED,
	PROPOSAL_TYPE_INCENTIVIZATION,
} from '../../../../src/app/modules/dexGovernance/constants';
import { ProposalsStore } from '../../../../src/app/modules/dexGovernance/stores';
import {
	addVotes,
	checkNonNegative,
	getVoteOutcome,
	hasEnded,
} from '../../../../src/app/modules/dexGovernance/utils/auxiliaryFunctions';

const { InMemoryPrefixedStateDB } = testing;

describe('dexGovernance:auxiliaryFunctions', () => {
	const poolId: PoolID = Buffer.from('0000000000000000000001000000000000c8', 'hex');
	const dexGovernanceModule = new DexGovernanceModule();

	const inMemoryPrefixedStateDB = new InMemoryPrefixedStateDB();
	const tokenMethod = new TokenMethod(
		dexGovernanceModule.stores,
		dexGovernanceModule.events,
		dexGovernanceModule.name,
	);
	const stateStore: PrefixedStateReadWriter = new PrefixedStateReadWriter(inMemoryPrefixedStateDB);

	const methodContext: MethodContext = createMethodContext({
		contextStore: new Map(),
		stateStore,
		eventQueue: new EventQueue(0),
	});

	let proposalsStore: ProposalsStore;

	const transferMock = jest.fn();
	const lockMock = jest.fn();
	const unlockMock = jest.fn();
	const getAvailableBalanceMock = jest.fn().mockReturnValue(BigInt(250));

	const proposal: Proposal = {
		creationHeight: 1,
		votesYes: BigInt(200),
		votesNo: BigInt(100),
		votesPass: BigInt(50),
		type: PROPOSAL_TYPE_INCENTIVIZATION,
		content: {
			text: Buffer.alloc(1),
			poolID: poolId,
			multiplier: 2,
			metadata: {
				title: Buffer.alloc(1),
				author: Buffer.alloc(1),
				summary: Buffer.alloc(1),
				discussionsTo: Buffer.alloc(1),
			},
		},
		status: PROPOSAL_STATUS_ACTIVE,
	};

	const indexBuffer = Buffer.alloc(4);
	indexBuffer.writeUInt32BE(0, 0);

	describe('constructor', () => {
		beforeEach(async () => {
			proposalsStore = dexGovernanceModule.stores.get(ProposalsStore);

			await proposalsStore.set(methodContext, indexBuffer, proposal);

			tokenMethod.transfer = transferMock;
			tokenMethod.lock = lockMock;
			tokenMethod.unlock = unlockMock;
			tokenMethod.getAvailableBalance = getAvailableBalanceMock.mockReturnValue(BigInt(250));

			tokenMethod.getTotalSupply = jest
				.fn()
				.mockReturnValue({ totalSupply: [{ totalSupply: BigInt(10000) }] });
		});
		it('getVoteOutcome', async () => {
			expect(
				await getVoteOutcome(methodContext, tokenMethod, BigInt(1), BigInt(1), BigInt(1)),
			).toEqual(PROPOSAL_STATUS_FINISHED_FAILED);
		});
		it('checkNonNegative', () => {
			expect(() => checkNonNegative(BigInt(1))).not.toThrow();
			expect(() => checkNonNegative(BigInt(-1))).toThrow();
		});
		it('hasEnded', async () => {
			expect(await hasEnded(methodContext, proposalsStore, 0, 1000, 500)).toBe(true);
		});
		it('addVotes', async () => {
			await expect(
				addVotes(methodContext, proposalsStore, 0, BigInt(1), DECISION_YES),
			).resolves.not.toThrow();
		});
	});
});
