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

import { TokenModule, Transaction, ValidatorsModule, VerifyStatus } from 'lisk-framework';
import { createMethodContext, EventQueue } from 'lisk-framework/dist-node/state_machine';
import { PrefixedStateReadWriter } from 'lisk-framework/dist-node/state_machine/prefixed_state_read_writer';
import { testing } from 'lisk-sdk';
import { DexModule } from '../../../../src/app/modules';
import { defaultConfig } from '../../../../src/app/modules/dex/constants';
import { createPoolSchema } from '../../../../src/app/modules/dex/schemas';
import {
	DexGlobalStore,
	DexGlobalStoreData,
} from '../../../../src/app/modules/dex/stores/dexGlobalStore';
import { PoolsStore, PoolsStoreData } from '../../../../src/app/modules/dex/stores/poolsStore';
import { Address, PositionID } from '../../../../src/app/modules/dex/types';
import { getPoolIDFromPositionID } from '../../../../src/app/modules/dex/utils/auxiliaryFunctions';
import { q96ToBytes, numberToQ96 } from '../../../../src/app/modules/dex/utils/q96';
import { createPoolFixtures } from './fixtures/createPoolFixture';
import { InMemoryPrefixedStateDB } from './inMemoryPrefixedState';

const { createTransactionContext } = testing;

describe('dex:command:createPool', () => {
	let dexModule: DexModule;
	let tokenModule: TokenModule;
	let validatorModule: ValidatorsModule;

	const senderAddress: Address = Buffer.from('0000000000000000', 'hex');
	const positionId: PositionID = Buffer.from('00000001000000000101643130', 'hex');
	// const localTokenID = Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]);
	// const secondTokenID = Buffer.from([1, 0, 0, 0, 0, 0, 0, 0]);
	let command;

	const stateStore = new PrefixedStateReadWriter(new InMemoryPrefixedStateDB());
	const methodContext = createMethodContext({
		stateStore,
		eventQueue: new EventQueue(0),
	});

	// const settings = {
	// 	poolCreationSettings: [
	// 		{
	// 			feeTier: 100,
	// 		},
	// 	],
	// };

	const poolsStoreData: PoolsStoreData = {
		liquidity: BigInt(5),
		sqrtPrice: q96ToBytes(BigInt(1)),
		feeGrowthGlobal0: q96ToBytes(numberToQ96(BigInt(10))),
		feeGrowthGlobal1: q96ToBytes(numberToQ96(BigInt(6))),
		tickSpacing: 1,
	};

	const dexGlobalStoreData: DexGlobalStoreData = {
		positionCounter: BigInt(10),
		collectableLSKFees: BigInt(10),
	};

	// const settingStoreData: SettingsStoreData = {
	// 	protocolFeeAddress: Buffer.from('0000000000000000', 'hex'),
	// 	protocolFeePart: 10,
	// 	validatorsLSKRewardsPart: 5,
	// 	poolCreationSettings: {
	// 		feeTier: 100,
	// 		tickSpacing: 1,
	// 	},
	// };

	beforeEach(async () => {
		dexModule = new DexModule();
		tokenModule = new TokenModule();
		validatorModule = new ValidatorsModule();

		const poolsStore = dexModule.stores.get(PoolsStore);
		const dexGlobalStore = dexModule.stores.get(DexGlobalStore);
		// const positionsStore = dexModule.stores.get(PositionsStore);

		await dexGlobalStore.set(methodContext, Buffer.alloc(0), dexGlobalStoreData);
		await poolsStore.setKey(
			methodContext,
			[senderAddress, getPoolIDFromPositionID(positionId)],
			poolsStoreData,
		);
		await poolsStore.set(methodContext, getPoolIDFromPositionID(positionId), poolsStoreData);

		tokenModule.method.mint = jest.fn().mockImplementation(async () => Promise.resolve());
		tokenModule.method.lock = jest.fn().mockImplementation(async () => Promise.resolve());
		tokenModule.method.unlock = jest.fn().mockImplementation(async () => Promise.resolve());
		tokenModule.method.transfer = jest.fn().mockImplementation(async () => Promise.resolve());
		tokenModule.method.getLockedAmount = jest.fn().mockResolvedValue(BigInt(1000));
		dexModule.addDependencies(tokenModule.method, validatorModule.method);
		command = dexModule.commands.find(e => e.name === 'createPool');
		command.init({ moduleConfig: defaultConfig, tokenMethod: tokenModule.method });
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

	describe('execute', () => {
		const context = createTransactionContext({
			transaction: new Transaction(createPoolFixtures[0][1] as any),
		});

		it(`should call token methods and emit events`, async () => {
			await command.execute(context.createCommandExecuteContext(createPoolSchema));
			expect(dexModule._tokenMethod.mint).toHaveBeenCalledTimes(3);
			expect(dexModule._tokenMethod.lock).toHaveBeenCalledTimes(2);
			expect(dexModule._tokenMethod.unlock).toHaveBeenCalledTimes(1);
			expect(dexModule._tokenMethod.transfer).toHaveBeenCalledTimes(101);

			const events = context.eventQueue.getEvents();
			const validatorTradeRewardsPayoutEvents = events.filter(
				e => e.toObject().name === 'validatorTradeRewardsPayoutEvent',
			);
			expect(validatorTradeRewardsPayoutEvents).toHaveLength(101);

			const generatorRewardMintedEvents = events.filter(
				e => e.toObject().name === 'generatorRewardMintedEvent',
			);
			expect(generatorRewardMintedEvents).toHaveLength(1);
		});
	});
});
