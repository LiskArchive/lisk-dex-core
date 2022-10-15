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
import { CollectFeesCommand } from '../../../../src/app/modules/dex/commands/collectFees';
import { collectFeesSchema } from '../../../../src/app/modules/dex/schemas';

describe('dex:command:collectFees', () => {
	const dexModule = new DexModule();
	let command: CollectFeesCommand;
	beforeEach(() => {
		command = new CollectFeesCommand(dexModule.stores, dexModule.events);
		command.init({
			tokenMethod: dexModule._tokenMethod
		});
	});

	describe('verify', () => {
		it('should be successful when all the parameters are correct', async () => {
			const context = createTransactionContext({
				transaction: new Transaction({
					module: 'dex',
					command: 'collectFees',
					fee: BigInt(5000000),
					nonce: BigInt(0),
					senderPublicKey: utils.getRandomBytes(32),
					params: codec.encode(collectFeesSchema, {
						positions:new Array(0),
					}),
					signatures: [utils.getRandomBytes(64)],
				}),
			});
			
			const result = await command.verify(context.createCommandVerifyContext(collectFeesSchema));
			
			expect(result.error?.message).not.toBeDefined();
			expect(result.status).toEqual(VerifyStatus.OK);
		});		

		it('should fail when positions size is more than MAX_NUM_POSITIONS_FEE_COLLECTION', async () => {
			const context = createTransactionContext({
				transaction: new Transaction({
					module: 'dex',
					command: 'collectFees',
					fee: BigInt(5000000),
					nonce: BigInt(0),
					senderPublicKey: utils.getRandomBytes(32),
					params: codec.encode(collectFeesSchema, {
						positions:new Array(24).fill({positionID: Buffer.from('0000000100', 'hex')}),
					}),
					signatures: [utils.getRandomBytes(64)],
					
					
				}),
			});
			const result = await command.verify(context.createCommandVerifyContext(collectFeesSchema));
			expect(result.error?.message).toBe("Please enter the correct positions");
			expect(result.status).toEqual(VerifyStatus.FAIL);
		});		
	});
});