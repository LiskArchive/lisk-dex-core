/* eslint-disable @typescript-eslint/no-unsafe-argument */
/*
 * Copyright © 2020 Lisk Foundation
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
import { PoSModule, TokenMethod } from 'lisk-framework';
import {
	createMethodContext,
	EventQueue,
	VerifyStatus,
} from 'lisk-framework/dist-node/state_machine';
import { PrefixedStateReadWriter } from 'lisk-framework/dist-node/state_machine/prefixed_state_read_writer';
import { PoSEndpoint } from 'lisk-framework/dist-node/modules/pos/endpoint';
import { loggerMock } from 'lisk-framework/dist-node/testing/mocks';
import {
	createBlockContext,
	createBlockHeaderWithDefaults,
	createFakeBlockHeader,
} from 'lisk-framework/dist-node/testing';
import { voteOnProposalParamsSchema } from '../../../../src/app/modules/dexGovernance/schemas';
import { Address, PoolID } from '../../../../src/app/modules/dex/types';
import { DexGovernanceModule } from '../../../../src/app/modules';
import { VoteOnPorposalCommand } from '../../../../src/app/modules/dexGovernance/commands/voteOnPorposal';
import { ProposalsStore, VotesStore } from '../../../../src/app/modules/dexGovernance/stores';
import {
	LENGTH_ADDRESS,
	PROPOSAL_STATUS_ACTIVE,
	PROPOSAL_TYPE_INCENTIVIZATION,
} from '../../../../src/app/modules/dexGovernance/constants';
import { Proposal } from '../../../../src/app/modules/dexGovernance/types';
import { sha256 } from '../../../../src/app/modules/dexRewards/constants';

const { createTransactionContext, InMemoryPrefixedStateDB } = testing;
const { utils } = cryptography;

describe('dexGovernance:command:voteOnPorposal', () => {
	const poolID: PoolID = Buffer.from('0000000000000000000001000000000000c8', 'hex');
	const proposalIndex = 1;
	const decision = 1;
	let command: VoteOnPorposalCommand;
	const pos = new PoSModule();
	const posEndpoint = new PoSEndpoint(pos.stores, pos.offchainStores);
	const stateStore = new PrefixedStateReadWriter(new InMemoryPrefixedStateDB());
	let votesStore: VotesStore;
	let proposalsStore: ProposalsStore;
	let verificationKey;

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
	tokenMethod.transfer = transferMock;
	tokenMethod.lock = lockMock;
	tokenMethod.unlock = unlockMock;

	beforeEach(async () => {
		command = new VoteOnPorposalCommand(dexGovernanceModule.stores, dexGovernanceModule.events);

		votesStore = dexGovernanceModule.stores.get(VotesStore);
		proposalsStore = dexGovernanceModule.stores.get(ProposalsStore);
		await proposalsStore.set(methodContext, indexBuffer, proposal);

		tokenMethod.transfer = transferMock;
		tokenMethod.lock = lockMock;
		tokenMethod.unlock = unlockMock;
		tokenMethod.getAvailableBalance = jest.fn().mockReturnValue(BigInt(500000));
		posEndpoint.getLockedStakedAmount = getLockedStakedAmountMock.mockReturnValue({ amount: 5 });

		verificationKey = sha256(senderAddress.toString()).slice(0, LENGTH_ADDRESS);

		command.init({
			posEndpoint,
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
		it('Cast a vote with x tokens and decision No', async () => {
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

			const dexGovernanceStore = dexGovernanceModule.stores.get(ProposalsStore);
			const votesStoreData = await votesStore.getKey(methodContext, [verificationKey]);
			expect((await dexGovernanceStore.getKey(methodContext, [indexBuffer])).votesNo).toBe(
				BigInt(105),
			);
			expect((await dexGovernanceStore.getKey(methodContext, [indexBuffer])).votesYes).toBe(
				BigInt(200),
			);
			expect(votesStoreData.voteInfos.length).toBeGreaterThan(0);

			const events = blockAfterExecuteContext.eventQueue.getEvents();
			const validatorRemoveLiquidityEvents = events.filter(
				e => e.toObject().name === 'proposalVoted',
			);
			expect(validatorRemoveLiquidityEvents).toHaveLength(1);
		});

		it('Cast a vote with x tokens and decision Yes', async () => {
			await expect(
				command.execute({
					contextStore: new Map(),
					stateStore,
					chainID: utils.getRandomBytes(32),
					params: {
						proposalIndex,
						decision: 0,
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
							decision: 0,
						}),
						signatures: [utils.getRandomBytes(64)],
					}),
				}),
			).resolves.toBeUndefined();

			const dexGovernanceStore = dexGovernanceModule.stores.get(ProposalsStore);
			const votesStoreData = await votesStore.getKey(methodContext, [verificationKey]);
			expect((await dexGovernanceStore.getKey(methodContext, [indexBuffer])).votesNo).toBe(
				BigInt(95),
			);
			expect((await dexGovernanceStore.getKey(methodContext, [indexBuffer])).votesYes).toBe(
				BigInt(205),
			);

			const events = blockAfterExecuteContext.eventQueue.getEvents();
			const validatorRemoveLiquidityEvents = events.filter(
				e => e.toObject().name === 'proposalVoted',
			);
			expect(validatorRemoveLiquidityEvents).toHaveLength(2);
			expect(votesStoreData.voteInfos.length).toBeGreaterThan(0);
		});
	});
});
