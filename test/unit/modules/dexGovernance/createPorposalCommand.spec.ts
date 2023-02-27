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
import { createFakeBlockHeader } from 'lisk-framework/dist-node/testing';
import { CreatePorposalCommand } from '../../../../src/app/modules/dexGovernance/commands/createPorposal';
import { createProposalParamsSchema } from '../../../../src/app/modules/dexGovernance/schemas';
import { Address, PoolID } from '../../../../src/app/modules/dex/types';
import { DexGovernanceModule } from '../../../../src/app/modules';

const { createTransactionContext, InMemoryPrefixedStateDB } = testing;
const { utils } = cryptography;

describe('dexGovernance:command:createPorposal', () => {
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

	let command: CreatePorposalCommand;
	const pos = new PoSModule();
	const posEndpoint = new PoSEndpoint(pos.stores, pos.offchainStores);
	const stateStore = new PrefixedStateReadWriter(new InMemoryPrefixedStateDB());
	const methodContext = createMethodContext({
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

	tokenMethod.transfer = transferMock;
	tokenMethod.lock = lockMock;
	tokenMethod.unlock = unlockMock;

	beforeEach(() => {
		command = new CreatePorposalCommand(dexGovernanceModule.stores, dexGovernanceModule.events);

		tokenMethod.transfer = transferMock;
		tokenMethod.lock = lockMock;
		tokenMethod.unlock = unlockMock;
		tokenMethod.getAvailableBalance = jest.fn().mockReturnValue(BigInt(500000));
		posEndpoint.getLockedStakedAmount = getLockedStakedAmountMock.mockReturnValue({ amount: 5 });

		command.init({
			tokenMethod,
			posEndpoint,
		});
	});

	describe('verify', () => {
		it('should be successful when all the parameters are correct', async () => {
			const context = createTransactionContext({
				transaction: new Transaction({
					module: 'dexGovernance',
					command: 'createPorposal',
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
					header: createFakeBlockHeader(),
					eventQueue: new EventQueue(0),
					getStore: (moduleID: Buffer, prefix: Buffer) => stateStore.getStore(moduleID, prefix),
					getMethodContext: () => methodContext,
					assets: { getAsset: jest.fn() },
					transaction: new Transaction({
						module: 'dex',
						command: 'removeLiquidty',
						fee: BigInt(5000000),
						nonce: BigInt(0),
						senderPublicKey: senderAddress,
						params: codec.encode(createProposalParamsSchema, {
							type: 1,
							content: {
								text: poolID,
								poolID,
								multiplier: 1,
								metadata: {
									title: poolID,
									author: poolID,
									summary: poolID,
									discussionsTo: poolID,
								},
							},
						}),
						signatures: [utils.getRandomBytes(64)],
					}),
				}),
			).rejects.toThrow();
		});
	});
});
