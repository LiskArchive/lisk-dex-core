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

import {
	Transaction
} from '@liskhq/lisk-chain';
import {
	codec
} from '@liskhq/lisk-codec';
import {
	utils
} from '@liskhq/lisk-cryptography';
import {
	VerifyStatus
} from 'lisk-framework';
import {
	createTransactionContext
} from 'lisk-framework/dist-node/testing';
import {
	DexModule
} from '../../../../src/app/modules';
import {
	CreatePositionCommand
} from '../../../../src/app/modules/dex/commands/createPosition';
import {
	MAX_TICK,
	MIN_TICK
} from '../../../../src/app/modules/dex/constants';
import {
	createPositionParamsSchema
} from '../../../../src/app/modules/dex/schemas';

describe('dex:command:createPosition', () => {
	const dexModule = new DexModule();

	// const localTokenID = Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]);
	// const secondTokenID = Buffer.from([1, 0, 0, 0, 0, 0, 0, 0]);
	let command: CreatePositionCommand;
	// let interopAPI: {
	// 	getOwnChainAccount: jest.Mock;
	// 	send: jest.Mock;
	// 	error: jest.Mock;
	// 	terminateChain: jest.Mock;
	// 	getChannel: jest.Mock;
	// };

	beforeEach(() => {
		command = new CreatePositionCommand(dexModule.stores, dexModule.events);
		// interopAPI = {
		// 	getOwnChainAccount: jest.fn().mockResolvedValue({ id: Buffer.from([0, 0, 0, 1]) }),
		// 	send: jest.fn(),
		// 	error: jest.fn(),
		// 	terminateChain: jest.fn(),
		// 	getChannel: jest.fn(),
		// };
		command.init({
			tokenMethod: dexModule._tokenMethod
		});
	});

	describe('verify', () => {
		it('should be successful when all the parameters are correct', async () => {
			const context = createTransactionContext({
				transaction: new Transaction({
					module: 'dex',
					command: 'createPosition',
					fee: BigInt(5000000),
					nonce: BigInt(0),
					senderPublicKey: utils.getRandomBytes(32),
					params: codec.encode(createPositionParamsSchema, {
						poolID: Buffer.from('0000000100', 'hex'),
						tickLower: MIN_TICK,
						tickUpper: MAX_TICK,
						amount0Desired: BigInt(1000),
						amount1Desired: BigInt(1000),
						amount0Min: BigInt(1000),
						amount1Min: BigInt(1000),
						maxTimestampValid: BigInt(1000)
					}),
					signatures: [utils.getRandomBytes(64)],
				}),
			});
			const result = await command.verify(context.createCommandVerifyContext(createPositionParamsSchema));

			expect(result.error?.message).not.toBeDefined();
			expect(result.status).toEqual(VerifyStatus.OK);
		});


		it('should fail when ticks are invalid', async () => {
			const context = createTransactionContext({
				transaction: new Transaction({
					module: 'dex',
					command: 'createPosition',
					fee: BigInt(5000000),
					nonce: BigInt(0),
					senderPublicKey: utils.getRandomBytes(32),
					params: codec.encode(createPositionParamsSchema, {
						poolID: Buffer.from('0000000100', 'hex'),
						tickLower: MIN_TICK - 1,
						tickUpper: MAX_TICK + 1,
						amount0Desired: BigInt(1000),
						amount1Desired: BigInt(1000),
						amount0Min: BigInt(1000),
						amount1Min: BigInt(1000),
						maxTimestampValid: BigInt(1000)
					}),
					signatures: [utils.getRandomBytes(64)],
				}),
			});
			const result = await command.verify(context.createCommandVerifyContext(createPositionParamsSchema));

			expect(result.error?.message).toBe('Please specify valid tick values');
			expect(result.status).toEqual(VerifyStatus.FAIL);
		});


		it('should fail when amounts are invalid', async () => {
			const context = createTransactionContext({
				transaction: new Transaction({
					module: 'dex',
					command: 'createPosition',
					fee: BigInt(5000000),
					nonce: BigInt(0),
					senderPublicKey: utils.getRandomBytes(32),
					params: codec.encode(createPositionParamsSchema, {
						poolID: Buffer.from('0000000100', 'hex'),
						tickLower: MIN_TICK,
						tickUpper: MAX_TICK,
						amount0Desired: BigInt(999),
						amount1Desired: BigInt(999),
						amount0Min: BigInt(1000),
						amount1Min: BigInt(1000),
						maxTimestampValid: BigInt(1000)
					}),
					signatures: [utils.getRandomBytes(64)],
				}),
			});
			const result = await command.verify(context.createCommandVerifyContext(createPositionParamsSchema));

			expect(result.error?.message).toBe('Please specify valid amounts');
			expect(result.status).toEqual(VerifyStatus.FAIL);
		});
	});
});