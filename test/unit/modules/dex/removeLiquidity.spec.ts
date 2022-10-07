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

import { Transaction } from '@liskhq/lisk-chain';
import { codec } from '@liskhq/lisk-codec';
import { utils } from '@liskhq/lisk-cryptography';
import { VerifyStatus } from 'lisk-framework';
import { createTransactionContext } from 'lisk-framework/dist-node/testing';
import { DexModule } from '../../../../src/app/modules';
import { RemoveLiquidityCommand } from '../../../../src/app/modules/dex/commands/removeLiquidity';
import { removeLiquiditySchema } from '../../../../src/app/modules/dex/schemas';


describe('dex:command:removeLiquidity', () => {
	const dexModule = new DexModule();
	let command: RemoveLiquidityCommand;
	beforeEach(() => {
		command = new RemoveLiquidityCommand(dexModule.stores, dexModule.events);
		command.init({
			tokenMethod: dexModule._tokenMethod
		});
	});

	describe('verify', () => {
		it('should be successful when all the parameters are correct', async () => {
			const context = createTransactionContext({
				transaction: new Transaction({
					module: 'dex',
					command: 'removeLiquidty',
					fee: BigInt(5000000),
					nonce: BigInt(0),
					senderPublicKey: utils.getRandomBytes(32),
					params: codec.encode(removeLiquiditySchema, {
						positionID:Buffer.from('0000000100', 'hex'),
                        liquidityToRemove:BigInt(250),
                        amount0Min:BigInt(1000),
                        amount1Min:BigInt(1000),
						maxTimestampValid: BigInt(1000)
					}),
					signatures: [utils.getRandomBytes(64)],
				}),
			});
			const result = await command.verify(context.createCommandVerifyContext(removeLiquiditySchema));

			expect(result.error?.message).not.toBeDefined();
			expect(result.status).toEqual(VerifyStatus.OK);
		});

		it('should fail when a parameter is not correct', async () => {
			const context = createTransactionContext({
				transaction: new Transaction({
					module: 'dex',
					command: 'removeLiquidty',
					fee: BigInt(5000000),
					nonce: BigInt(0),
					senderPublicKey: utils.getRandomBytes(32),
					params: codec.encode(removeLiquiditySchema, {
						positionID:Buffer.from('0000000100', 'hex'),
                        liquidityToRemove:BigInt(250),
                        amount0Min:Buffer.from('0000000100', 'hex'),
                        amount1Min:BigInt(1000),
						maxTimestampValid: BigInt(1000)
					}),
					signatures: [utils.getRandomBytes(64)],
				}),
			});
			const result = await command.verify(context.createCommandVerifyContext(removeLiquiditySchema));

			expect(result.error?.message).not.toBeDefined();
			expect(result.status).toEqual(VerifyStatus.OK);
		});
	});
});