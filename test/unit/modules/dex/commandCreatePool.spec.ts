/* eslint-disable @typescript-eslint/no-unsafe-argument */
/*
 * Copyright © 2024 Lisk Foundation
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
	FeeModule,
	TokenModule,
	Transaction,
	ValidatorsModule,
	VerifyStatus,
} from 'lisk-framework';
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
import { Address, PoolID, PositionID } from '../../../../src/app/modules/dex/types';
import { getPoolIDFromPositionID } from '../../../../src/app/modules/dex/utils/auxiliaryFunctions';
import { q96ToBytes, numberToQ96 } from '../../../../src/app/modules/dex/utils/q96';
import {
	createPoolFixtures,
	createRandomPoolFixturesGenerator,
} from './fixtures/createPoolFixture';

const { createTransactionContext, InMemoryPrefixedStateDB } = testing;

const skipOnCI = process.env.CI ? describe.skip : describe;

describe('dex:command:createPool', () => {
	const poolId: PoolID = Buffer.from('0000000000000000000001000000000000c8', 'hex');
	let dexModule: DexModule;
	let tokenModule: TokenModule;
	let validatorModule: ValidatorsModule;
	let feeModule: FeeModule;

	const senderAddress: Address = Buffer.from('0000000000000000', 'hex');
	const positionId: PositionID = Buffer.from('00000001000000000101643130', 'hex');
	let command;

	const poolsStoreData: PoolsStoreData = {
		liquidity: BigInt(5),
		sqrtPrice: q96ToBytes(BigInt(1)),
		incentivesPerLiquidityAccumulator: q96ToBytes(numberToQ96(BigInt(0))),
		heightIncentivesUpdate: 5,
		feeGrowthGlobal0: q96ToBytes(numberToQ96(BigInt(10))),
		feeGrowthGlobal1: q96ToBytes(numberToQ96(BigInt(6))),
		tickSpacing: 1,
	};

	const dexGlobalStoreData: DexGlobalStoreData = {
		positionCounter: BigInt(15),
		poolCreationSettings: [{ feeTier: 100, tickSpacing: 1 }],
		incentivizedPools: [{ poolId, multiplier: 10 }],
		totalIncentivesMultiplier: 1,
	};

	beforeEach(() => {
		dexModule = new DexModule();
		tokenModule = new TokenModule();
		validatorModule = new ValidatorsModule();
		feeModule = new FeeModule();

		feeModule.method.payFee = jest.fn();

		tokenModule.method.mint = jest.fn().mockImplementation(async () => Promise.resolve());
		tokenModule.method.lock = jest.fn().mockImplementation(async () => Promise.resolve());
		tokenModule.method.unlock = jest.fn().mockImplementation(async () => Promise.resolve());
		tokenModule.method.transfer = jest.fn().mockImplementation(async () => Promise.resolve());
		tokenModule.method.getLockedAmount = jest.fn().mockResolvedValue(BigInt(1000));
		dexModule.addDependencies(tokenModule.method, validatorModule.method, feeModule.method);
		command = dexModule.commands.find(e => e.name === 'createPool');
		command.init({
			moduleConfig: defaultConfig,
			tokenMethod: tokenModule.method,
			feeMethod: feeModule.method,
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
				expect(result.error?.message).toBeUndefined();
				expect(result.status).toEqual(VerifyStatus.OK);
			} else {
				expect(result.error?.message).toBe(err);
				expect(result.status).toEqual(VerifyStatus.FAIL);
			}
		});
	});

	describe('execute', () => {
		let context: ReturnType<typeof createTransactionContext>;
		const stateStore = new PrefixedStateReadWriter(new InMemoryPrefixedStateDB());
		beforeEach(async () => {
			context = createTransactionContext({
				stateStore,
				transaction: new Transaction(createPoolFixtures[0][1] as any),
			});

			const poolsStore = dexModule.stores.get(PoolsStore);
			const dexGlobalStore = dexModule.stores.get(DexGlobalStore);

			await dexGlobalStore.set(stateStore, Buffer.alloc(0), dexGlobalStoreData);
			await poolsStore.setKey(
				stateStore,
				[senderAddress, getPoolIDFromPositionID(positionId)],
				poolsStoreData,
			);
			await poolsStore.set(stateStore, getPoolIDFromPositionID(positionId), poolsStoreData);
		});

		it.skip(`should call token methods and emit events`, async () => {
			await command.execute(context.createCommandExecuteContext(createPoolSchema));
			expect(dexModule._tokenMethod.lock).toHaveBeenCalledTimes(2);
			expect(dexModule._tokenMethod.transfer).toHaveBeenCalledTimes(3);
			expect(dexModule._feeMethod.payFee).toHaveBeenCalledTimes(1);

			const events = context.eventQueue.getEvents();
			const poolCreatedEvents = events.filter(e => e.toObject().name === 'poolCreated');
			const positionCreatedEvents = events.filter(e => e.toObject().name === 'positionCreated');

			expect(poolCreatedEvents).toHaveLength(1);
			expect(positionCreatedEvents).toHaveLength(1);
		});

		skipOnCI('stress test for checking the event emission and the time taken', () => {
			// eslint-disable-next-line @typescript-eslint/no-floating-promises
			(async () => {
				const testarray = Array.from({ length: 10000 });
				await Promise.all(testarray.map(() => stress()));
			})();

			function stress() {
				it(`should emit poolCreatedEvent and positionCreatedEvent for every iteration`, async () => {
					context = createTransactionContext({
						stateStore,
						transaction: new Transaction(createRandomPoolFixturesGenerator()[0][1] as any),
					});
					await command.execute(context.createCommandExecuteContext(createPoolSchema));
					expect(dexModule._tokenMethod.lock).toHaveBeenCalledTimes(2);
					expect(dexModule._tokenMethod.transfer).toHaveBeenCalledTimes(3);
					expect(dexModule._feeMethod.payFee).toHaveBeenCalledTimes(1);
					const events = context.eventQueue.getEvents();
					const poolCreatedEvents = events.filter(e => e.toObject().name === 'poolCreated');
					const positionCreatedEvents = events.filter(e => e.toObject().name === 'positionCreated');
					expect(poolCreatedEvents).toHaveLength(1);
					expect(positionCreatedEvents).toHaveLength(1);
				});
			}
		});
	});
});
