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
import { MAX_TICK, MIN_TICK } from '../../../../src/app/modules/dex/constants';
import { addLiquiditySchema } from '../../../../src/app/modules/dex/schemas';
import {
	DexGlobalStore,
	DexGlobalStoreData,
} from '../../../../src/app/modules/dex/stores/dexGlobalStore';
import { PoolsStore, PoolsStoreData } from '../../../../src/app/modules/dex/stores/poolsStore';
import {
	PositionsStore,
	PositionsStoreData,
} from '../../../../src/app/modules/dex/stores/positionsStore';
import {
	PriceTicksStore,
	PriceTicksStoreData,
} from '../../../../src/app/modules/dex/stores/priceTicksStore';
import { Address, PoolID } from '../../../../src/app/modules/dex/types';
import { tickToPrice } from '../../../../src/app/modules/dex/utils/math';
import { q96ToBytes, numberToQ96 } from '../../../../src/app/modules/dex/utils/q96';
import { addLiquidityFixtures } from './fixtures/addLiquidityFixture';

const { createTransactionContext, InMemoryPrefixedStateDB } = testing;

const skipOnCI = process.env.CI ? describe.skip : describe;

describe('dex:command:addLiquidity', () => {
	const poolId: PoolID = Buffer.from('0000000000000000000001000000000000c8', 'hex');
	let dexModule: DexModule;
	let tokenModule: TokenModule;
	let validatorModule: ValidatorsModule;
	let feeModule: FeeModule;

	const senderAddress: Address = Buffer.from('d4b6810c78e3a3023e6bfaefc2bf6b9fe0dbf89b', 'hex');
	let commandAddLiquidity;

	const poolsStoreData: PoolsStoreData = {
		liquidity: BigInt(5),
		sqrtPrice: q96ToBytes(BigInt('327099227039063106')),
		incentivesPerLiquidityAccumulator: q96ToBytes(numberToQ96(BigInt(0))),
		heightIncentivesUpdate: 5,
		feeGrowthGlobal0: q96ToBytes(numberToQ96(BigInt(10))),
		feeGrowthGlobal1: q96ToBytes(numberToQ96(BigInt(6))),
		tickSpacing: 1,
	};

	const dexGlobalStoreData: DexGlobalStoreData = {
		positionCounter: BigInt(10),
		poolCreationSettings: [{ feeTier: 100, tickSpacing: 1 }],
		incentivizedPools: [{ poolId, multiplier: 10 }],
		totalIncentivesMultiplier: 1,
	};

	const priceTicksStoreDataTickLower: PriceTicksStoreData = {
		liquidityNet: BigInt(5),
		liquidityGross: BigInt(5),
		feeGrowthOutside0: q96ToBytes(numberToQ96(BigInt(0))),
		feeGrowthOutside1: q96ToBytes(numberToQ96(BigInt(0))),
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
		tickLower: MIN_TICK + 100,
		tickUpper: MAX_TICK - 100,
		liquidity: BigInt(2000000),
		feeGrowthInsideLast0: q96ToBytes(numberToQ96(BigInt(3))),
		feeGrowthInsideLast1: q96ToBytes(numberToQ96(BigInt(1))),
		ownerAddress: senderAddress,
		incentivesPerLiquidityLast: Buffer.alloc(0),
	};

	beforeEach(() => {
		dexModule = new DexModule();
		tokenModule = new TokenModule();
		validatorModule = new ValidatorsModule();
		feeModule = new FeeModule();

		tokenModule.method.mint = jest.fn().mockImplementation(async () => Promise.resolve());
		tokenModule.method.lock = jest.fn().mockImplementation(async () => Promise.resolve());
		tokenModule.method.unlock = jest.fn().mockImplementation(async () => Promise.resolve());
		tokenModule.method.transfer = jest.fn().mockImplementation(async () => Promise.resolve());
		tokenModule.method.getLockedAmount = jest.fn().mockResolvedValue(BigInt(1000));
		dexModule.addDependencies(tokenModule.method, validatorModule.method, feeModule.method);
		commandAddLiquidity = dexModule.commands.find(e => e.name === 'addLiquidity');
		commandAddLiquidity.init({ tokenMethod: tokenModule.method });
	});

	describe('verify', () => {
		it.each(addLiquidityFixtures)('%s', async (...args) => {
			const [_desc, input, err] = args;
			const context = createTransactionContext({
				transaction: new Transaction(input as any),
			});

			const result = await commandAddLiquidity.verify(
				context.createCommandVerifyContext(addLiquiditySchema),
			);

			if (err === false) {
				expect(result.error?.message).toBeUndefined();
				expect(result.status).toEqual(VerifyStatus.OK);
			} else {
				expect(result.error?.message).toContain(err);
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
				transaction: new Transaction(addLiquidityFixtures[0][1] as any),
			});

			const poolsStore = dexModule.stores.get(PoolsStore);
			const positionsStore = dexModule.stores.get(PositionsStore);
			const dexGlobalStore = dexModule.stores.get(DexGlobalStore);
			const priceTicksStore = dexModule.stores.get(PriceTicksStore);

			await dexGlobalStore.set(stateStore, Buffer.alloc(0), dexGlobalStoreData);
			await poolsStore.setKey(
				stateStore,
				[senderAddress, Buffer.from('1d0fbf936f280000000100', 'hex')],
				poolsStoreData,
			);
			await poolsStore.set(stateStore, Buffer.from('0000000100', 'hex'), poolsStoreData);

			await priceTicksStore.setKey(
				stateStore,
				[Buffer.from('00000001007ff2767c', 'hex')],
				priceTicksStoreDataTickLower,
			);
			await priceTicksStore.setKey(
				stateStore,
				[Buffer.from('0000000100800d8984', 'hex')],
				priceTicksStoreDataTickUpper,
			);
			await priceTicksStore.setKey(
				stateStore,
				[
					Buffer.from('00000001007ff276', 'hex'),
					q96ToBytes(tickToPrice(positionsStoreData.tickLower)),
				],
				priceTicksStoreDataTickLower,
			);
			await priceTicksStore.setKey(
				stateStore,
				[
					Buffer.from('00000001007ff276', 'hex'),
					q96ToBytes(tickToPrice(positionsStoreData.tickUpper)),
				],
				priceTicksStoreDataTickUpper,
			);
			await positionsStore.set(
				stateStore,
				Buffer.from('d4b6810c78e3a3023e6bfaefc2bf6b9fe0dbf89b0000000100', 'hex'),
				positionsStoreData,
			);
			await positionsStore.set(
				stateStore,
				Buffer.from('a2badd91e7ed423b56322b68f2beee4c638f05060000000100', 'hex'),
				positionsStoreData,
			);
			await positionsStore.set(stateStore, Buffer.from('0000000100', 'hex'), positionsStoreData);
		});

		it(`should call token methods and emit events`, async () => {
			await commandAddLiquidity.execute(context.createCommandExecuteContext(addLiquiditySchema));
			expect(dexModule._tokenMethod.transfer).toHaveBeenCalledTimes(1);

			const events = context.eventQueue.getEvents();
			const positionUpdatedEvents = events.filter(e => e.toObject().name === 'positionUpdated');
			expect(positionUpdatedEvents).toHaveLength(1);
		});

		skipOnCI('stress test for checking the events', () => {
			// eslint-disable-next-line @typescript-eslint/no-floating-promises
			(async () => {
				const testarray = Array.from({ length: 10000 });
				await Promise.all(testarray.map(() => stress()));
			})();

			function stress() {
				context = createTransactionContext({
					stateStore,
					transaction: new Transaction(addLiquidityFixtures[0][1] as any),
				});
				it('should call execute methods and emit positionUpdatedEvent', async () => {
					await commandAddLiquidity.execute(
						context.createCommandExecuteContext(addLiquiditySchema),
					);
					expect(dexModule._tokenMethod.transfer).toHaveBeenCalledTimes(1);
					const events = context.eventQueue.getEvents();
					const positionUpdatedEvents = events.filter(e => e.toObject().name === 'positionUpdated');
					expect(positionUpdatedEvents).toHaveLength(1);
				});
			}
		});
	});
});
