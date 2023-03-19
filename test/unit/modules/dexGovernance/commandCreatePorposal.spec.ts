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

import { codec, Transaction, cryptography, testing, FeeMethod } from 'lisk-sdk';
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
} from 'lisk-framework/dist-node/testing';
import { Address, PoolID } from '../../../../src/app/modules/dex/types';
import { DexGovernanceModule } from '../../../../src/app/modules';
import { IndexStore, ProposalsStore } from '../../../../src/app/modules/dexGovernance/stores';
import {
	MAX_NUM_RECORDED_VOTES,
	PROPOSAL_STATUS_ACTIVE,
	PROPOSAL_TYPE_INCENTIVIZATION,
} from '../../../../src/app/modules/dexGovernance/constants';
import { Proposal } from '../../../../src/app/modules/dexGovernance/types';
import { PoolsStore, PoolsStoreData } from '../../../../src/app/modules/dex/stores/poolsStore';
import { numberToQ96, q96ToBytes } from '../../../../src/app/modules/dex/utils/q96';
import { tickToPrice } from '../../../../src/app/modules/dex/utils/math';
import { createProposalParamsSchema } from '../../../../src/app/modules/dexGovernance/schemas';
import { CreateProposalCommand } from '../../../../src/app/modules/dexGovernance/commands/createProposal';

const { createTransactionContext, InMemoryPrefixedStateDB } = testing;
const { utils } = cryptography;

describe('dexGovernance:command:createproposal', () => {
	const poolID: PoolID = Buffer.from('0000000000000000000001000000000000c8', 'hex').slice(0, 16);
	const type = 1;
	const content = {
		text: Buffer.from('000000_text', 'hex'),
		poolID,
		multiplier: 1,
		metadata: {
			title: Buffer.from('000000_title', 'hex'),
			author: Buffer.from('000000_author', 'hex'),
			summary: Buffer.from('000000_summary', 'hex'),
			discussionsTo: Buffer.from('000000_discussionsTo', 'hex'),
		},
	};

	let command: CreateProposalCommand;
	const pos = new PoSModule();
	const posEndpoint = new PoSEndpoint(pos.stores, pos.offchainStores);
	const stateStore = new PrefixedStateReadWriter(new InMemoryPrefixedStateDB());

	let poolsStore: PoolsStore;
	let proposalsStore: ProposalsStore;
	let indexStore: IndexStore;

	let methodContext = createMethodContext({
		contextStore: new Map(),
		stateStore,
		eventQueue: new EventQueue(0),
	});

	const dexGovernanceModule = new DexGovernanceModule();
	let feeMethod: FeeMethod;
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

	const indexBuffer = Buffer.alloc(4);
	indexBuffer.writeUInt32BE(1, 0);

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

	const poolsStoreData: PoolsStoreData = {
		liquidity: BigInt(5),
		sqrtPrice: q96ToBytes(BigInt(tickToPrice(5))),
		incentivesPerLiquidityAccumulator: q96ToBytes(numberToQ96(BigInt(0))),
		heightIncentivesUpdate: 5,
		feeGrowthGlobal0: q96ToBytes(numberToQ96(BigInt(0))),
		feeGrowthGlobal1: q96ToBytes(numberToQ96(BigInt(0))),
		tickSpacing: 1,
	};

	const indexStoreData = {
		newestIndex: 100,
		nextOutcomeCheckIndex: 1,
		nextQuorumCheckIndex: 1,
	};

	beforeEach(async () => {
		command = new CreateProposalCommand(dexGovernanceModule.stores, dexGovernanceModule.events);
		feeMethod = new FeeMethod(dexGovernanceModule.stores, dexGovernanceModule.events);
		proposalsStore = dexGovernanceModule.stores.get(ProposalsStore);
		indexStore = dexGovernanceModule.stores.get(IndexStore);
		poolsStore = dexGovernanceModule.stores.get(PoolsStore);

		await proposalsStore.set(methodContext, indexBuffer, proposal);
		await indexStore.set(methodContext, Buffer.from('0'), indexStoreData);
		await poolsStore.set(methodContext, poolID, poolsStoreData);
		const indexBufferTemp = Buffer.alloc(4);
		indexBufferTemp.writeUInt32BE(indexStoreData.newestIndex - MAX_NUM_RECORDED_VOTES + 1, 0);
		await proposalsStore.set(methodContext, indexBufferTemp, proposal);

		tokenMethod.transfer = transferMock;
		tokenMethod.lock = lockMock;
		tokenMethod.unlock = unlockMock;
		tokenMethod.getAvailableBalance = jest.fn().mockReturnValue(BigInt(500000));
		posEndpoint.getLockedStakedAmount = getLockedStakedAmountMock.mockReturnValue({ amount: 5 });
		feeMethod.payFee = jest.fn();

		command.init({
			tokenMethod,
			posEndpoint,
			feeMethod,
		});
	});

	describe('verify', () => {
		it('should be successful when all the parameters are correct', async () => {
			const context = createTransactionContext({
				transaction: new Transaction({
					module: 'dex',
					command: 'createproposal',
					fee: BigInt(5000000),
					nonce: BigInt(0),
					senderPublicKey: senderAddress,
					params: codec.encode(createProposalParamsSchema, {
						type,
						content,
					}),
					signatures: [utils.getRandomBytes(64)],
				}),
			});
			const result = await command.verify(
				context.createCommandVerifyContext(createProposalParamsSchema),
			);
			expect(result.error?.message).toBeUndefined();
			expect(result.status).toEqual(VerifyStatus.OK);
		});
	});

	describe('execute', () => {
		it('execute block should pass', async () => {
			const blockHeader = createBlockHeaderWithDefaults({ height: 260001 });
			const blockAfterExecuteContext = createBlockContext({
				header: blockHeader,
			}).getBlockAfterExecuteContext();
			methodContext = createMethodContext({
				contextStore: new Map(),
				stateStore,
				eventQueue: blockAfterExecuteContext.eventQueue,
			});
			await expect(
				command.execute({
					contextStore: new Map(),
					stateStore,
					chainID: utils.getRandomBytes(32),
					params: {
						type,
						content,
					},
					logger: loggerMock,
					header: blockHeader,
					eventQueue: blockAfterExecuteContext.eventQueue,
					getStore: (moduleID: Buffer, prefix: Buffer) => stateStore.getStore(moduleID, prefix),
					getMethodContext: () => methodContext,
					assets: { getAsset: jest.fn() },
					transaction: new Transaction({
						module: 'dex',
						command: 'createproposal',
						fee: BigInt(5000000),
						nonce: BigInt(0),
						senderPublicKey: senderAddress,
						params: codec.encode(createProposalParamsSchema, {
							type,
							content,
						}),
						signatures: [utils.getRandomBytes(64)],
					}),
				}),
			).resolves.toBeUndefined();
			const events = blockAfterExecuteContext.eventQueue.getEvents();
			const validatorRemoveLiquidityEvents = events.filter(
				e => e.toObject().name === 'proposalCreated',
			);
			expect(validatorRemoveLiquidityEvents).toHaveLength(1);
		});
	});
});
