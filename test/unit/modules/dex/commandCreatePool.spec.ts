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
import { testing } from 'lisk-sdk';
import { DexModule } from '../../../../src/app/modules';
import { CreatePoolCommand } from '../../../../src/app/modules/dex/commands/createPool';
import { defaultConfig } from '../../../../src/app/modules/dex/constants';
import { createPoolSchema } from '../../../../src/app/modules/dex/schemas';
import { createPoolFixtures } from './fixtures/createPoolFixture';

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
		it.each(createPoolFixtures)('%s', async (...args) => {
			const [_desc, input, err] = args;
			const context = createTransactionContext({
				transaction: new Transaction(input as any),
			});

			const result = await command.verify(context.createCommandVerifyContext(createPoolSchema));

			if (err === false) {
				expect(result.error?.message).not.toBeDefined();
				expect(result.status).toEqual(VerifyStatus.OK);
			} else {
				expect(result.error?.message).toBe(err);
				expect(result.status).toEqual(VerifyStatus.FAIL);
			}
		});
	});
});
