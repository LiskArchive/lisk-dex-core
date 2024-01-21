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

import { codec, Transaction, cryptography, testing } from 'lisk-sdk';
import { PoSMethod, PoSModule, TokenMethod } from 'lisk-framework';
import {
	createMethodContext,
	EventQueue,
	VerifyStatus,
} from 'lisk-framework/dist-node/state_machine';
import { PrefixedStateReadWriter } from 'lisk-framework/dist-node/state_machine/prefixed_state_read_writer';
import { loggerMock } from 'lisk-framework/dist-node/testing/mocks';
import {
	createBlockContext,
	createBlockHeaderWithDefaults,
	createFakeBlockHeader,
} from 'lisk-framework/dist-node/testing';
import { voteOnProposalParamsSchema } from '../../../../src/app/modules/dexGovernance/schemas';
import { Address, PoolID } from '../../../../src/app/modules/dex/types';
import { DexGovernanceModule } from '../../../../src/app/modules';
import { VoteOnProposalCommand } from '../../../../src/app/modules/dexGovernance/commands/voteOnProposal';
import { ProposalsStore, VotesStore } from '../../../../src/app/modules/dexGovernance/stores';
import {
	LENGTH_ADDRESS,
	PROPOSAL_STATUS_ACTIVE,
	PROPOSAL_TYPE_INCENTIVIZATION,
} from '../../../../src/app/modules/dexGovernance/constants';
import { sha256 } from '../../../../src/app/modules/dexRewards/constants';
import { Proposal, Vote } from '../../../../src/app/modules/dexGovernance/types';

const { createTransactionContext, InMemoryPrefixedStateDB } = testing;
const { utils } = cryptography;

describe('dexGovernance:command:voteOnPorposal', () => {
	const poolID: PoolID = Buffer.from('0000000000000000000001000000000000c8', 'hex');
	const proposalIndex = 1;
	const decision = 1;
	let command: VoteOnProposalCommand;
	const pos = new PoSModule();
	const posMethod = new PoSMethod(pos.stores, pos.offchainStores);
	const stateStore = new PrefixedStateReadWriter(new InMemoryPrefixedStateDB());
	let votesStore: VotesStore;
	let proposalsStore: ProposalsStore;

	let methodContext = createMethodContext({
		contextStore: new Map(),
		stateStore,
		eventQueue: new EventQueue(0),
	});

	const dexGovernanceModule = new DexGovernanceModule();

	const senderAddress: Address = Buffer.from('0000000000000000', 'hex');

	const transferMock = jest.fn();
	const lockMock = jest.fn();
	const unlockMock = jest.fn();
	const getLockedStakedAmountMock = jest.fn();

	const tokenMethod = new TokenMethod(
		dexGovernanceModule.stores,
		dexGovernanceModule.events,
		dexGovernanceModule.name,
	);

	const vote: Vote = {
		address: senderAddress,
		voteInfos: [
			{
				proposalIndex: 1,
				decision: 1,
				amount: BigInt(5),
			},
		],
	};
	const proposal: Proposal = {
		creationHeight: 1,
		votesYes: BigInt(200),
		votesNo: BigInt(100),
		votesPass: BigInt(50),
		type: PROPOSAL_TYPE_INCENTIVIZATION,
		content: {
			text: Buffer.alloc(1),
			poolID,
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
	indexBuffer.writeUInt32BE(1, 0);

	const key = sha256(senderAddress.toString()).slice(0, LENGTH_ADDRESS);

	tokenMethod.transfer = transferMock;
	tokenMethod.lock = lockMock;
	tokenMethod.unlock = unlockMock;

	beforeEach(async () => {
		command = new VoteOnProposalCommand(dexGovernanceModule.stores, dexGovernanceModule.events);

		votesStore = dexGovernanceModule.stores.get(VotesStore);
		proposalsStore = dexGovernanceModule.stores.get(ProposalsStore);

		await votesStore.set(methodContext, key, vote);
		await votesStore.set(methodContext, senderAddress, vote);
		await proposalsStore.set(methodContext, indexBuffer, proposal);

		tokenMethod.transfer = transferMock;
		tokenMethod.lock = lockMock;
		tokenMethod.unlock = unlockMock;
		tokenMethod.getAvailableBalance = jest.fn().mockReturnValue(BigInt(500000));
		posMethod.getLockedStakedAmount = getLockedStakedAmountMock.mockReturnValue({ amount: 5 });

		command.init({
			posMethod,
			methodContext,
		});
	});

	describe('verify', () => {
		it('should be successful when all the parameters are correct', async () => {
			const context = createTransactionContext({
				transaction: new Transaction({
					module: 'dex',
					command: 'voteOnPorosal',
					fee: BigInt(5000000),
					nonce: BigInt(0),
					senderPublicKey: senderAddress,
					params: codec.encode(voteOnProposalParamsSchema, {
						proposalIndex,
						decision,
					}),
					signatures: [utils.getRandomBytes(64)],
				}),
			});
			const result = await command.verify(
				context.createCommandVerifyContext(voteOnProposalParamsSchema),
			);
			expect(result.error?.message).toBeUndefined();
			expect(result.status).toEqual(VerifyStatus.OK);
		});
		it('should Fail with Decision does not exist message', async () => {
			const context = createTransactionContext({
				transaction: new Transaction({
					module: 'dex',
					command: 'voteOnPorosal',
					fee: BigInt(5000000),
					nonce: BigInt(0),
					senderPublicKey: senderAddress,
					params: codec.encode(voteOnProposalParamsSchema, {
						proposalIndex,
						decision: 3,
					}),
					signatures: [utils.getRandomBytes(64)],
				}),
			});
			const result = await command.verify(
				context.createCommandVerifyContext(voteOnProposalParamsSchema),
			);
			expect(result.error?.message).toBe('Decision does not exist');
			expect(result.status).toEqual(VerifyStatus.FAIL);
		});
		it('should Fail with Proposal does not exist message', async () => {
			proposal.status = 1;
			await proposalsStore.set(methodContext, indexBuffer, proposal);
			const context = createTransactionContext({
				transaction: new Transaction({
					module: 'dex',
					command: 'voteOnPorosal',
					fee: BigInt(5000000),
					nonce: BigInt(0),
					senderPublicKey: senderAddress,
					params: codec.encode(voteOnProposalParamsSchema, {
						proposalIndex,
						decision: 2,
					}),
					signatures: [utils.getRandomBytes(64)],
				}),
			});
			const result = await command.verify(
				context.createCommandVerifyContext(voteOnProposalParamsSchema),
			);
			expect(result.error?.message).toBe('Proposal does not exist');
			expect(result.status).toEqual(VerifyStatus.FAIL);
		});
	});

	describe('execute', () => {
		const blockHeader = createBlockHeaderWithDefaults({ height: 101 });
		const blockAfterExecuteContext = createBlockContext({
			header: blockHeader,
		}).getBlockAfterExecuteContext();
		methodContext = createMethodContext({
			contextStore: new Map(),
			stateStore,
			eventQueue: blockAfterExecuteContext.eventQueue,
		});
		it.skip('execute block should pass', async () => {
			await expect(
				command.execute({
					contextStore: new Map(),
					stateStore,
					chainID: utils.getRandomBytes(32),
					params: {
						proposalIndex,
						decision,
					},
					logger: loggerMock,
					header: createFakeBlockHeader(),
					eventQueue: blockAfterExecuteContext.eventQueue,
					getStore: (moduleID: Buffer, prefix: Buffer) => stateStore.getStore(moduleID, prefix),
					getMethodContext: () => methodContext,
					assets: { getAsset: jest.fn() },
					transaction: new Transaction({
						module: 'dex',
						command: 'voteOnPorposal',
						fee: BigInt(5000000),
						nonce: BigInt(0),
						senderPublicKey: senderAddress,
						params: codec.encode(voteOnProposalParamsSchema, {
							proposalIndex,
							decision,
						}),
						signatures: [utils.getRandomBytes(64)],
					}),
				}),
			).resolves.toBeUndefined();
			const events = blockAfterExecuteContext.eventQueue.getEvents();
			const validatorRemoveLiquidityEvents = events.filter(
				e => e.toObject().name === 'proposalVoted',
			);
			expect(validatorRemoveLiquidityEvents).toHaveLength(1);
		});
	});
});
