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
import { createPositionSchema } from '../../../../src/app/modules/dex/schemas';
import {
	DexGlobalStore,
	DexGlobalStoreData,
} from '../../../../src/app/modules/dex/stores/dexGlobalStore';
import { PoolsStore, PoolsStoreData } from '../../../../src/app/modules/dex/stores/poolsStore';
import { PositionsStoreData } from '../../../../src/app/modules/dex/stores/positionsStore';
import {
	PriceTicksStore,
	PriceTicksStoreData,
	tickToBytes,
} from '../../../../src/app/modules/dex/stores/priceTicksStore';
import { Address, PoolID } from '../../../../src/app/modules/dex/types';
import { tickToPrice } from '../../../../src/app/modules/dex/utils/math';
import { q96ToBytes, numberToQ96 } from '../../../../src/app/modules/dex/utils/q96';
import { createPositionFixtures } from './fixtures/createPositionFixture';

const { createTransactionContext, InMemoryPrefixedStateDB } = testing;

const skipOnCI = process.env.CI ? describe.skip : describe;

describe('dex:command:createPosition', () => {
	const poolId: PoolID = Buffer.from('0000000000000000000001000000000000c8', 'hex');
	let dexModule: DexModule;
	let tokenModule: TokenModule;
	let validatorModule: ValidatorsModule;
	let feeModule: FeeModule;

	const senderAddress: Address = Buffer.from('0000000000000000', 'hex');
	let commandCreatePosition;

	const poolsStoreData: PoolsStoreData = {
		liquidity: BigInt(5),
		sqrtPrice: q96ToBytes(BigInt('327099227039063106')),
		incentivesPerLiquidityAccumulator: q96ToBytes(numberToQ96(BigInt(1000))),
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

	const priceTicksStoreDataTickLower: PriceTicksStoreData = {
		liquidityNet: BigInt(5),
		liquidityGross: BigInt(5),
		feeGrowthOutside0: q96ToBytes(numberToQ96(BigInt(8))),
		feeGrowthOutside1: q96ToBytes(numberToQ96(BigInt(5))),
		incentivesPerLiquidityOutside: q96ToBytes(numberToQ96(BigInt(2))),
	};

	const priceTicksStoreDataTickUpper: PriceTicksStoreData = {
		liquidityNet: BigInt(5),
		liquidityGross: BigInt(5),
		feeGrowthOutside0: q96ToBytes(numberToQ96(BigInt(0))),
		feeGrowthOutside1: q96ToBytes(numberToQ96(BigInt(0))),
		incentivesPerLiquidityOutside: q96ToBytes(numberToQ96(BigInt(3))),
	};

	const positionsStoreData: PositionsStoreData = {
		tickLower: -10,
		tickUpper: 10,
		liquidity: BigInt(1000),
		feeGrowthInsideLast0: q96ToBytes(numberToQ96(BigInt(0))),
		feeGrowthInsideLast1: q96ToBytes(numberToQ96(BigInt(0))),
		ownerAddress: senderAddress,
		incentivesPerLiquidityLast: Buffer.alloc(0),
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
		commandCreatePosition = dexModule.commands.find(e => e.name === 'createPosition');
		commandCreatePosition.init({ tokenMethod: tokenModule.method, feeMethod: feeModule.method });
	});

	describe('verify', () => {
		it.each(createPositionFixtures)('%s', async (...args) => {
			const [_desc, input, err] = args;
			const context = createTransactionContext({
				transaction: new Transaction(input as any),
			});

			const result = await commandCreatePosition.verify(
				context.createCommandVerifyContext(createPositionSchema),
			);

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
		let contextPosition: ReturnType<typeof createTransactionContext>;
		const stateStore = new PrefixedStateReadWriter(new InMemoryPrefixedStateDB());

		beforeEach(async () => {
			contextPosition = createTransactionContext({
				stateStore,
				transaction: new Transaction(createPositionFixtures[0][1] as any),
			});

			const poolsStore = dexModule.stores.get(PoolsStore);
			const dexGlobalStore = dexModule.stores.get(DexGlobalStore);
			const priceTicksStore = dexModule.stores.get(PriceTicksStore);

			await dexGlobalStore.set(stateStore, Buffer.alloc(0), dexGlobalStoreData);
			await poolsStore.setKey(
				stateStore,
				[senderAddress, Buffer.from('0000000100000000010164000000', 'hex')],
				poolsStoreData,
			);
			await poolsStore.set(
				stateStore,
				Buffer.from('0000000100000000010164000000', 'hex'),
				poolsStoreData,
			);

			await priceTicksStore.setKey(
				stateStore,
				[
					Buffer.from('0000000100000000010164000000', 'hex'),
					tickToBytes(positionsStoreData.tickLower),
				],
				priceTicksStoreDataTickLower,
			);
			await priceTicksStore.setKey(
				stateStore,
				[
					Buffer.from('0000000100000000010164000000', 'hex'),
					tickToBytes(positionsStoreData.tickUpper),
				],
				priceTicksStoreDataTickUpper,
			);
			await priceTicksStore.setKey(
				stateStore,
				[
					Buffer.from('0000000100000000010164000000', 'hex'),
					q96ToBytes(tickToPrice(positionsStoreData.tickLower)),
				],
				priceTicksStoreDataTickLower,
			);
			await priceTicksStore.setKey(
				stateStore,
				[
					Buffer.from('0000000100000000010164000000', 'hex'),
					q96ToBytes(tickToPrice(positionsStoreData.tickUpper)),
				],
				priceTicksStoreDataTickUpper,
			);
		});

		it.skip(`should call token methods and emit events`, async () => {
			await commandCreatePosition.execute(
				contextPosition.createCommandExecuteContext(createPositionSchema),
			);
			expect(dexModule._tokenMethod.transfer).toHaveBeenCalledTimes(1);
			expect(dexModule._feeMethod.payFee).toHaveBeenCalledTimes(1);

			const events = contextPosition.eventQueue.getEvents();
			const positionCreatedEvents = events.filter(e => e.toObject().name === 'positionCreated');
			expect(positionCreatedEvents).toHaveLength(1);
		});

		skipOnCI('stress test for checking the events', () => {
			// eslint-disable-next-line @typescript-eslint/no-floating-promises
			(async () => {
				const testarray = Array.from({ length: 10000 });
				await Promise.all(testarray.map(() => stress()));
			})();

			function stress() {
				contextPosition = createTransactionContext({
					stateStore,
					transaction: new Transaction(createPositionFixtures[0][1] as any),
				});
				it('should call execute methods and emit events', async () => {
					await commandCreatePosition.execute(
						contextPosition.createCommandExecuteContext(createPositionSchema),
					);
					expect(dexModule._tokenMethod.transfer).toHaveBeenCalledTimes(1);
					expect(dexModule._feeMethod.payFee).toHaveBeenCalledTimes(1);

					const events = contextPosition.eventQueue.getEvents();
					const positionCreatedEvents = events.filter(e => e.toObject().name === 'positionCreated');
					expect(positionCreatedEvents).toHaveLength(1);
				});
			}
		});
	});
});
