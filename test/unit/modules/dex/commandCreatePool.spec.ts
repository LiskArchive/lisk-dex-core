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

import { Transaction, VerifyStatus } from 'lisk-framework';
import { codec, testing } from 'lisk-sdk';
import { utils } from '@liskhq/lisk-cryptography';
import { DexModule } from '../../../../src/app/modules';
import { CreatePoolCommand } from '../../../../src/app/modules/dex/commands/createPool';
import { defaultConfig, MAX_TICK, MIN_TICK } from '../../../../src/app/modules/dex/constants';
import { createPoolSchema } from '../../../../src/app/modules/dex/schemas';

const { createTransactionContext } = testing;

describe('dex:command:createPool', () => {
	const dexModule = new DexModule();

	// const localTokenID = Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]);
	// const secondTokenID = Buffer.from([1, 0, 0, 0, 0, 0, 0, 0]);
	let command: CreatePoolCommand;
	// let interopAPI: {
	// 	getOwnChainAccount: jest.Mock;
	// 	send: jest.Mock;
	// 	error: jest.Mock;
	// 	terminateChain: jest.Mock;
	// 	getChannel: jest.Mock;
	// };

	beforeEach(() => {
		command = new CreatePoolCommand(dexModule.stores, dexModule.events);
		// interopAPI = {
		// 	getOwnChainAccount: jest.fn().mockResolvedValue({ id: Buffer.from([0, 0, 0, 1]) }),
		// 	send: jest.fn(),
		// 	error: jest.fn(),
		// 	terminateChain: jest.fn(),
		// 	getChannel: jest.fn(),
		// };
		command.init({
			moduleConfig: defaultConfig,
			tokenMethod: dexModule._tokenMethod,
		});
	});

	describe('verify', () => {
		it('should be successful when all the parameters are correct', async () => {
			const context = createTransactionContext({
				transaction: new Transaction({
					module: 'dex',
					command: 'createPool',
					fee: BigInt(5000000),
					nonce: BigInt(0),
					senderPublicKey: utils.getRandomBytes(32),
					params: codec.encode(createPoolSchema, {
						tokenID0: Buffer.from('0000000100', 'hex'),
						tokenID1: Buffer.from('0000000101', 'hex'),
						feeTier: 100,
						tickInitialPrice: 1,
						initialPosition: {
							tickLower: MIN_TICK,
							tickUpper: MAX_TICK,
							amount0Desired: BigInt(1000),
							amount1Desired: BigInt(1000),
						},
						maxTimestampValid: BigInt(1000),
					}),
					signatures: [utils.getRandomBytes(64)],
				}),
			});
			const result = await command.verify(context.createCommandVerifyContext(createPoolSchema));

			expect(result.error?.message).not.toBeDefined();
			expect(result.status).toEqual(VerifyStatus.OK);
		});

		it('should fail when tokenID0 and tokenID1 are not sorted lexicographically', async () => {
			const context = createTransactionContext({
				transaction: new Transaction({
					module: 'dex',
					command: 'createPool',
					fee: BigInt(5000000),
					nonce: BigInt(0),
					senderPublicKey: utils.getRandomBytes(32),
					params: codec.encode(createPoolSchema, {
						tokenID0: Buffer.from('0000000101', 'hex'),
						tokenID1: Buffer.from('0000000100', 'hex'),
						feeTier: 100,
						tickInitialPrice: 1,
						initialPosition: {
							tickLower: MIN_TICK,
							tickUpper: MAX_TICK,
							amount0Desired: BigInt(1000),
							amount1Desired: BigInt(1000),
						},
						maxTimestampValid: BigInt(1000),
					}),
					signatures: [utils.getRandomBytes(64)],
				}),
			});
			const result = await command.verify(context.createCommandVerifyContext(createPoolSchema));

			expect(result.error?.message).toBe('Please sort tokenID0 and tokenID1 lexicographically.');
			expect(result.status).toEqual(VerifyStatus.FAIL);
		});

		it('should fail when amount0Desired or amount1Desired are zero', async () => {
			const context = createTransactionContext({
				transaction: new Transaction({
					module: 'dex',
					command: 'createPool',
					fee: BigInt(5000000),
					nonce: BigInt(0),
					senderPublicKey: utils.getRandomBytes(32),
					params: codec.encode(createPoolSchema, {
						tokenID0: Buffer.from('0000000100', 'hex'),
						tokenID1: Buffer.from('0000000101', 'hex'),
						feeTier: 100,
						tickInitialPrice: 1,
						initialPosition: {
							tickLower: MIN_TICK,
							tickUpper: MAX_TICK,
							amount0Desired: BigInt(0),
							amount1Desired: BigInt(0),
						},
						maxTimestampValid: BigInt(1000),
					}),
					signatures: [utils.getRandomBytes(64)],
				}),
			});
			const result = await command.verify(context.createCommandVerifyContext(createPoolSchema));

			expect(result.error?.message).toBe('Please specify amount0Desired or amount1Desired.');
			expect(result.status).toEqual(VerifyStatus.FAIL);
		});

		it('should fail when tickLower and tickUpper do not meet requirements', async () => {
			const context = createTransactionContext({
				transaction: new Transaction({
					module: 'dex',
					command: 'createPool',
					fee: BigInt(5000000),
					nonce: BigInt(0),
					senderPublicKey: utils.getRandomBytes(32),
					params: codec.encode(createPoolSchema, {
						tokenID0: Buffer.from('0000000100', 'hex'),
						tokenID1: Buffer.from('0000000101', 'hex'),
						feeTier: 100,
						tickInitialPrice: 1,
						initialPosition: {
							tickLower: MIN_TICK - 10,
							tickUpper: MAX_TICK + 10,
							amount0Desired: BigInt(1000),
							amount1Desired: BigInt(1000),
						},
						maxTimestampValid: BigInt(1000),
					}),
					signatures: [utils.getRandomBytes(64)],
				}),
			});
			const result = await command.verify(context.createCommandVerifyContext(createPoolSchema));

			expect(result.error?.message).toBe('Please specify valid tick values.');
			expect(result.status).toEqual(VerifyStatus.FAIL);
		});
	});
});
