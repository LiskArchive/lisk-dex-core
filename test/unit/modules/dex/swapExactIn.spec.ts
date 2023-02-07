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
import { DexModule } from '../../../../src/app/modules';
import { SwapExactInCommand } from '../../../../src/app/modules/dex/commands/swapExactIn';
import { swapExactInCommandSchema } from '../../../../src/app/modules/dex/schemas';

const {
	createTransactionContext,
} = testing;

import {
	VerifyStatus,
} from 'lisk-framework/dist-node/state_machine';
const { utils } = cryptography;


import { Address, PoolID } from '../../../../src/app/modules/dex/types';
import { TokenID } from 'lisk-framework/dist-node/modules/token/types';

describe ('swapEactIn', ()=>{
    let command: SwapExactInCommand;
    const dexModule = new DexModule();
    
    const senderAddress: Address = Buffer.from('0000000000000000', 'hex');
    const poolId: PoolID = Buffer.from('0000000000000000000001000000000000c8', 'hex');
    const poolIdLSK = Buffer.from('0000000100000000', 'hex');
    const tokenIdIn: TokenID = Buffer.from('0000000000000000', 'hex');
	const tokenIdOut: TokenID = Buffer.from('0000010000000000', 'hex');
	    
    beforeEach(async () =>{
        command = new SwapExactInCommand(dexModule.stores, dexModule.events);
    })

    describe('verify', ()=>{
        it('should be successful when all the parameters are correct', async () => {
			const context = createTransactionContext({
				transaction: new Transaction({
					module: 'dex',
					command: 'swapExactIn',
					fee: BigInt(5000000),
					nonce: BigInt(0),
					senderPublicKey: senderAddress,
					params: codec.encode(swapExactInCommandSchema, {
						tokenIdIn,
						amountTokenIn: BigInt(250),
						tokenIdOut,
						minAmountTokenOut: BigInt(10),
						swapRoute: [poolId, poolIdLSK],
                        maxTimestampValid:BigInt(5)
					}),
					signatures: [utils.getRandomBytes(64)],
				}),
			});
			const result = await command.verify(
				context.createCommandVerifyContext(swapExactInCommandSchema),
			);
			expect(result.error?.message).not.toBeDefined();
			expect(result.status).toEqual(VerifyStatus.OK);
		});
    })
})
