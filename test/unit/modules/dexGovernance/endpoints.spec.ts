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

import { TokenMethod, testing } from 'lisk-framework';
import { MethodContext } from 'lisk-sdk';
import { createMethodContext, EventQueue } from 'lisk-framework/dist-node/state_machine';

import { PoolID } from '../../../../src/app/modules/dex/types';
import { DexGovernanceModule } from '../../../../src/app/modules';
import { Index, Proposal, Vote } from '../../../../src/app/modules/dexGovernance/types';
import {
	PROPOSAL_STATUS_ACTIVE,
	PROPOSAL_TYPE_INCENTIVIZATION,
} from '../../../../src/app/modules/dexGovernance/constants';
import {
	IndexStore,
	ProposalsStore,
	VotesStore,
} from '../../../../src/app/modules/dexGovernance/stores';
import { createTransientModuleEndpointContext } from '../../../context/createContext';
import { PrefixedStateReadWriter } from '../../../stateMachine/prefixedStateReadWriter';
import { DexGovernanceEndpoint } from '../../../../src/app/modules/dexGovernance/endpoint';

const { InMemoryPrefixedStateDB } = testing;

describe('dexGovernance:endpoints', () => {
	const poolId: PoolID = Buffer.from('0000000000000000000001000000000000c8', 'hex');
	const dexGovernanceModule = new DexGovernanceModule();

	const inMemoryPrefixedStateDB = new InMemoryPrefixedStateDB();
	const tokenMethod = new TokenMethod(
		dexGovernanceModule.stores,
		dexGovernanceModule.events,
		dexGovernanceModule.name,
	);
	const stateStore: PrefixedStateReadWriter = new PrefixedStateReadWriter(inMemoryPrefixedStateDB);

	let proposalsStore: ProposalsStore;
	let indexStore: IndexStore;
	let votesStore: VotesStore;

	let endpoint: DexGovernanceEndpoint;

	const methodContext: MethodContext = createMethodContext({
		contextStore: new Map(),
		stateStore,
		eventQueue: new EventQueue(0),
	});

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

	const index: Index = {
		newestIndex: 1,
		nextOutcomeCheckIndex: 100,
		nextQuorumCheckIndex: 100,
	};

	const vote: Vote = {
		address: Buffer.from('00000000', 'hex'),
		voteInfos: [
			{
				proposalIndex: 0,
				decision: 1,
				amount: BigInt(1000),
			},
		],
	};

	const indexBuffer = Buffer.alloc(4);
	indexBuffer.writeUInt32BE(0, 0);

	describe('constructor', () => {
		beforeEach(async () => {
			proposalsStore = dexGovernanceModule.stores.get(ProposalsStore);
			indexStore = dexGovernanceModule.stores.get(IndexStore);
			votesStore = dexGovernanceModule.stores.get(VotesStore);
			endpoint = new DexGovernanceEndpoint(
				dexGovernanceModule.stores,
				dexGovernanceModule.offchainStores,
			);

			await proposalsStore.set(methodContext, indexBuffer, proposal);
			await indexStore.set(methodContext, Buffer.alloc(0), index);
			await votesStore.set(methodContext, Buffer.from('0', 'hex'), vote);

			tokenMethod.transfer = transferMock;
			tokenMethod.lock = lockMock;
			tokenMethod.unlock = unlockMock;
			tokenMethod.getAvailableBalance = getAvailableBalanceMock.mockReturnValue(BigInt(250));

			tokenMethod.getTotalSupply = jest
				.fn()
				.mockReturnValue({ totalSupply: [{ totalSupply: BigInt(10000) }] });
		});
		it('getProposal', async () => {
			const moduleEndpointContext = createTransientModuleEndpointContext({
				stateStore,
				params: { proposal: 0 },
			});
			await expect(endpoint.getProposal(moduleEndpointContext)).resolves.toHaveProperty('proposal');
		});
		it('getUserVotes', async () => {
			const moduleEndpointContext = createTransientModuleEndpointContext({
				stateStore,
				params: { voterAddress: '0' },
			});
			await expect(endpoint.getUserVotes(moduleEndpointContext)).resolves.toMatchObject({
				voteInfos: [{ amount: BigInt(1000), decision: 1, proposalIndex: 0 }],
			});
		});
		it('getIndexStore', async () => {
			const moduleEndpointContext = createTransientModuleEndpointContext({
				stateStore,
			});
			await expect(endpoint.getIndexStore(moduleEndpointContext)).resolves.toMatchObject({
				indexStore: index,
			});
		});
	});
});
