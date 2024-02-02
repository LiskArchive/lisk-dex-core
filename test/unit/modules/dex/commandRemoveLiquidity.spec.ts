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

import { codec, Transaction, cryptography, testing } from 'lisk-sdk';
import { TokenMethod } from 'lisk-framework';
import {
	createMethodContext,
	EventQueue,
	MethodContext,
	VerifyStatus,
} from 'lisk-framework/dist-node/state_machine';
import { loggerMock } from 'lisk-framework/dist-node/testing/mocks';
import { PrefixedStateReadWriter } from 'lisk-framework/dist-node/state_machine/prefixed_state_read_writer';
import { DexModule } from '../../../../src/app/modules';
import { RemoveLiquidityCommand } from '../../../../src/app/modules/dex/commands/removeLiquidity';
import { removeLiquiditySchema } from '../../../../src/app/modules/dex/schemas';

import { PoolsStore, PositionsStore } from '../../../../src/app/modules/dex/stores';
import { PositionsStoreData } from '../../../../src/app/modules/dex/stores/positionsStore';
import { numberToQ96, q96ToBytes } from '../../../../src/app/modules/dex/utils/q96';
import { Address, PoolID, PositionID } from '../../../../src/app/modules/dex/types';
import { PoolsStoreData } from '../../../../src/app/modules/dex/stores/poolsStore';
import { getPoolIDFromPositionID } from '../../../../src/app/modules/dex/utils/auxiliaryFunctions';
import {
	DexGlobalStore,
	DexGlobalStoreData,
} from '../../../../src/app/modules/dex/stores/dexGlobalStore';
import {
	PriceTicksStore,
	PriceTicksStoreData,
	tickToBytes,
} from '../../../../src/app/modules/dex/stores/priceTicksStore';
import { tickToPrice } from '../../../../src/app/modules/dex/utils/math';

const {
	createBlockContext,
	createBlockHeaderWithDefaults,
	createFakeBlockHeader,
	createTransactionContext,
	InMemoryPrefixedStateDB,
} = testing;
const { utils } = cryptography;

const skipOnCI = process.env.CI ? describe.skip : describe;

describe('dex:command:removeLiquidity', () => {
	const poolId: PoolID = Buffer.from('0000000000000000000001000000000000c8', 'hex');
	let command: RemoveLiquidityCommand;
	let stateStore: PrefixedStateReadWriter;
	let methodContext: MethodContext;

	const dexModule = new DexModule();

	const senderAddress: Address = Buffer.from('0000000000000000', 'hex');
	const positionId: PositionID = Buffer.from('00000001000000000101643130', 'hex');
	const liquidityToRemove = BigInt(-2);

	const maxTimestampValid = BigInt(100000000000);

	const transferMock = jest.fn();
	const lockMock = jest.fn();
	const unlockMock = jest.fn();

	const tokenMethod = new TokenMethod(dexModule.stores, dexModule.events, dexModule.name);
	let poolsStore: PoolsStore;
	let priceTicksStore: PriceTicksStore;
	let dexGlobalStore: DexGlobalStore;
	let positionsStore: PositionsStore;

	stateStore = new PrefixedStateReadWriter(new InMemoryPrefixedStateDB());
	methodContext = createMethodContext({
		contextStore: new Map(),
		stateStore,
		eventQueue: new EventQueue(0),
	});

	const poolsStoreData: PoolsStoreData = {
		liquidity: BigInt(5),
		sqrtPrice: q96ToBytes(BigInt('327099227039063106')),
		incentivesPerLiquidityAccumulator: q96ToBytes(numberToQ96(BigInt(0))),
		heightIncentivesUpdate: 5,
		feeGrowthGlobal0: q96ToBytes(numberToQ96(BigInt(10))),
		feeGrowthGlobal1: q96ToBytes(numberToQ96(BigInt(6))),
		tickSpacing: 1,
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
		feeGrowthOutside0: q96ToBytes(numberToQ96(BigInt(4))),
		feeGrowthOutside1: q96ToBytes(numberToQ96(BigInt(3))),
		incentivesPerLiquidityOutside: q96ToBytes(numberToQ96(BigInt(3))),
	};

	const dexGlobalStoreData: DexGlobalStoreData = {
		positionCounter: BigInt(10),
		poolCreationSettings: [{ feeTier: 100, tickSpacing: 1 }],
		incentivizedPools: [{ poolId, multiplier: 10 }],
		totalIncentivesMultiplier: 1,
	};
	const positionsStoreData: PositionsStoreData = {
		tickLower: -8,
		tickUpper: -5,
		liquidity: BigInt(2000000),
		feeGrowthInsideLast0: q96ToBytes(numberToQ96(BigInt(3))),
		feeGrowthInsideLast1: q96ToBytes(numberToQ96(BigInt(1))),
		ownerAddress: senderAddress,
		incentivesPerLiquidityLast: Buffer.alloc(0),
	};

	beforeEach(async () => {
		command = new RemoveLiquidityCommand(dexModule.stores, dexModule.events);

		poolsStore = dexModule.stores.get(PoolsStore);
		priceTicksStore = dexModule.stores.get(PriceTicksStore);
		dexGlobalStore = dexModule.stores.get(DexGlobalStore);
		positionsStore = dexModule.stores.get(PositionsStore);

		await dexGlobalStore.set(methodContext, Buffer.from([]), dexGlobalStoreData);
		await poolsStore.setKey(
			methodContext,
			[senderAddress, getPoolIDFromPositionID(positionId)],
			poolsStoreData,
		);
		await poolsStore.set(methodContext, getPoolIDFromPositionID(positionId), poolsStoreData);
		await priceTicksStore.setKey(
			methodContext,
			[getPoolIDFromPositionID(positionId), tickToBytes(positionsStoreData.tickLower)],
			priceTicksStoreDataTickLower,
		);
		await priceTicksStore.setKey(
			methodContext,
			[getPoolIDFromPositionID(positionId), tickToBytes(positionsStoreData.tickUpper)],
			priceTicksStoreDataTickUpper,
		);
		await priceTicksStore.setKey(
			methodContext,
			[getPoolIDFromPositionID(positionId), q96ToBytes(tickToPrice(positionsStoreData.tickLower))],
			priceTicksStoreDataTickLower,
		);
		await priceTicksStore.setKey(
			methodContext,
			[getPoolIDFromPositionID(positionId), q96ToBytes(tickToPrice(positionsStoreData.tickUpper))],
			priceTicksStoreDataTickUpper,
		);

		await positionsStore.set(methodContext, positionId, positionsStoreData);
		await positionsStore.setKey(methodContext, [senderAddress, positionId], positionsStoreData);

		tokenMethod.transfer = transferMock;
		tokenMethod.lock = lockMock;
		tokenMethod.unlock = unlockMock;

		command.init({
			tokenMethod,
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
					senderPublicKey: senderAddress,
					params: codec.encode(removeLiquiditySchema, {
						positionID: Buffer.from('0000000100', 'hex'),
						liquidityToRemove: BigInt(250),
						amount0Min: BigInt(1000),
						amount1Min: BigInt(1000),
						maxTimestampValid,
					}),
					signatures: [utils.getRandomBytes(64)],
				}),
			});
			const result = await command.verify(
				context.createCommandVerifyContext(removeLiquiditySchema),
			);
			expect(result.error?.message).toBeUndefined();
			expect(result.status).toEqual(VerifyStatus.OK);
		});
		it('should not be successful when current timestamp is over maxTimestampValid', async () => {
			const context = createTransactionContext({
				transaction: new Transaction({
					module: 'dex',
					command: 'removeLiquidty',
					fee: BigInt(5000000),
					nonce: BigInt(0),
					senderPublicKey: senderAddress,
					params: codec.encode(removeLiquiditySchema, {
						positionID: Buffer.from('0000000100', 'hex'),
						liquidityToRemove: BigInt(250),
						amount0Min: BigInt(1000),
						amount1Min: BigInt(1000),
						maxTimestampValid: BigInt(0),
					}),
					signatures: [utils.getRandomBytes(64)],
				}),
			});
			const result = await command.verify(
				context.createCommandVerifyContext(removeLiquiditySchema),
			);
			expect(result.error?.message).toBe('Current timestamp is over maxTimestampValid');
			expect(result.status).toEqual(VerifyStatus.FAIL);
		});
	});

	describe('execute block should fail as positionID is not same as positionsStore', () => {
		it('should terminate and throw error if the positionID is not same as positionsStore doesnt have position with the specified positionID', async () => {
			await expect(
				command.execute({
					contextStore: new Map(),
					stateStore,
					chainID: utils.getRandomBytes(32),
					params: {
						positionID: Buffer.from('0000000100', 'hex'),
						liquidityToRemove,
						amount0Min: BigInt(1000),
						amount1Min: BigInt(1000),
						maxTimestampValid,
					},
					logger: loggerMock,
					header: createFakeBlockHeader(),
					eventQueue: new EventQueue(0),
					getStore: (moduleID: Buffer, prefix: Buffer) => stateStore.getStore(moduleID, prefix),
					getMethodContext: () => methodContext,
					assets: { getAsset: jest.fn() },
					transaction: new Transaction({
						module: 'dex',
						command: 'removeLiquidty',
						fee: BigInt(5000000),
						nonce: BigInt(0),
						senderPublicKey: senderAddress,
						params: codec.encode(removeLiquiditySchema, {
							positionID: Buffer.from('0000000100', 'hex'),
							liquidityToRemove,
							amount0Min: BigInt(1000),
							amount1Min: BigInt(1000),
							maxTimestampValid,
						}),
						signatures: [utils.getRandomBytes(64)],
					}),
				}),
			).rejects.toThrow();
		});
	});

	describe('execute block failure due to liquidityToRemove > totalLiquiidty', () => {
		it('should terminate and throw error', async () => {
			await expect(
				command.execute({
					contextStore: new Map(),
					stateStore,
					chainID: utils.getRandomBytes(32),
					params: {
						positionID: positionId,
						liquidityToRemove: BigInt(-1000000000000000),
						amount0Min: BigInt(0),
						amount1Min: BigInt(0),
						maxTimestampValid,
					},
					logger: loggerMock,
					header: createFakeBlockHeader(),
					eventQueue: new EventQueue(0),
					getStore: (moduleID: Buffer, prefix: Buffer) => stateStore.getStore(moduleID, prefix),
					getMethodContext: () => methodContext,
					assets: { getAsset: jest.fn() },
					transaction: new Transaction({
						module: 'dex',
						command: 'removeLiquidty',
						fee: BigInt(5000000),
						nonce: BigInt(0),
						senderPublicKey: senderAddress,
						params: codec.encode(removeLiquiditySchema, {
							positionID: positionId,
							liquidityToRemove: BigInt(-1000000000000000),
							amount0Min: BigInt(1000),
							amount1Min: BigInt(1000),
							maxTimestampValid,
						}),
						signatures: [utils.getRandomBytes(64)],
					}),
				}),
			).rejects.toThrow();
		});
	});

	describe('execute successfully', () => {
		const blockHeader = createBlockHeaderWithDefaults({ height: 101 });
		stateStore = new PrefixedStateReadWriter(new InMemoryPrefixedStateDB());
		const blockAfterExecuteContext = createBlockContext({
			header: blockHeader,
		}).getBlockAfterExecuteContext();
		methodContext = createMethodContext({
			contextStore: new Map(),
			stateStore,
			eventQueue: blockAfterExecuteContext.eventQueue,
		});
		it('should remove liquidity from an existing position', async () => {
			await expect(
				command.execute({
					contextStore: new Map(),
					stateStore,
					chainID: utils.getRandomBytes(32),
					params: {
						positionID: positionId,
						liquidityToRemove,
						amount0Min: BigInt(0),
						amount1Min: BigInt(0),
						maxTimestampValid,
					},
					logger: loggerMock,
					header: blockHeader,
					eventQueue: blockAfterExecuteContext.eventQueue,
					getStore: (moduleID: Buffer, prefix: Buffer) => stateStore.getStore(moduleID, prefix),
					getMethodContext: () => methodContext,
					assets: { getAsset: jest.fn() },
					transaction: new Transaction({
						module: 'dex',
						command: 'removeLiquidty',
						fee: BigInt(5000000),
						nonce: BigInt(0),
						senderPublicKey: senderAddress,
						params: codec.encode(removeLiquiditySchema, {
							positionID: positionId,
							liquidityToRemove,
							amount0Min: BigInt(1000),
							amount1Min: BigInt(1000),
							maxTimestampValid,
						}),
						signatures: [utils.getRandomBytes(64)],
					}),
				}),
			).resolves.toBeUndefined();
			expect(tokenMethod.transfer).toHaveBeenCalledTimes(3);
			expect(tokenMethod.unlock).toHaveBeenCalledTimes(2);
			expect(
				(await dexModule.stores.get(PositionsStore).get(methodContext, positionId)).liquidity,
			).toBe(positionsStoreData.liquidity + liquidityToRemove);
			const events = blockAfterExecuteContext.eventQueue.getEvents();
			const validatorRemoveLiquidityEvents = events.filter(
				e => e.toObject().name === 'removeLiquidity',
			);
			expect(validatorRemoveLiquidityEvents).toHaveLength(1);
		});
	});

	describe('execute should terminate and throw error as amount1Min > amount1', () => {
		it('should throw Error', async () => {
			await expect(
				command.execute({
					contextStore: new Map(),
					stateStore,
					chainID: utils.getRandomBytes(32),
					params: {
						positionID: positionId,
						liquidityToRemove,
						amount0Min: BigInt(0),
						amount1Min: BigInt(1000),
						maxTimestampValid,
					},
					logger: loggerMock,
					header: createFakeBlockHeader(),
					eventQueue: new EventQueue(0),
					getStore: (moduleID: Buffer, prefix: Buffer) => stateStore.getStore(moduleID, prefix),
					getMethodContext: () => methodContext,
					assets: { getAsset: jest.fn() },
					transaction: new Transaction({
						module: 'dex',
						command: 'removeLiquidty',
						fee: BigInt(5000000),
						nonce: BigInt(0),
						senderPublicKey: senderAddress,
						params: codec.encode(removeLiquiditySchema, {
							positionID: positionId,
							liquidityToRemove,
							amount0Min: BigInt(1000),
							amount1Min: BigInt(1000),
							maxTimestampValid,
						}),
						signatures: [utils.getRandomBytes(64)],
					}),
				}),
			).rejects.toThrow('Update position amounts are more then minimum amounts');
		});
	});

	describe('execute should terminate and throw error as amount0Min > amount0', () => {
		it.skip('should throw Error', async () => {
			await expect(
				command.execute({
					contextStore: new Map(),
					stateStore,
					chainID: utils.getRandomBytes(32),
					params: {
						positionID: positionId,
						liquidityToRemove,
						amount0Min: BigInt('158456325028528675187087900671'),
						amount1Min: BigInt(0),
						maxTimestampValid,
					},
					logger: loggerMock,
					header: createFakeBlockHeader(),
					eventQueue: new EventQueue(0),
					getStore: (moduleID: Buffer, prefix: Buffer) => stateStore.getStore(moduleID, prefix),
					getMethodContext: () => methodContext,
					assets: { getAsset: jest.fn() },
					transaction: new Transaction({
						module: 'dex',
						command: 'removeLiquidty',
						fee: BigInt(5000000),
						nonce: BigInt(0),
						senderPublicKey: senderAddress,
						params: codec.encode(removeLiquiditySchema, {
							positionID: positionId,
							liquidityToRemove,
							amount0Min: BigInt(1000),
							amount1Min: BigInt(1000),
							maxTimestampValid,
						}),
						signatures: [utils.getRandomBytes(64)],
					}),
				}),
			).rejects.toThrow('Update position amounts are more then minimum amounts');
		});
	});

	skipOnCI('stress test for checking the events', () => {
		// eslint-disable-next-line @typescript-eslint/no-floating-promises
		(async () => {
			const testarray = Array.from({ length: 10000 });
			await Promise.all(testarray.map(() => stress()));
		})();

		function stress() {
			const blockHeader = createBlockHeaderWithDefaults({ height: 101 });

			const blockAfterExecuteContext = createBlockContext({
				header: blockHeader,
			}).getBlockAfterExecuteContext();

			const stressTestMethodContext = createMethodContext({
				contextStore: new Map(),
				stateStore,
				eventQueue: blockAfterExecuteContext.eventQueue,
			});

			it('stress', async () => {
				await command.execute({
					contextStore: new Map(),
					stateStore,
					chainID: utils.getRandomBytes(32),
					params: {
						positionID: positionId,
						liquidityToRemove: BigInt(-5),
						amount0Min: BigInt(0),
						amount1Min: BigInt(0),
						maxTimestampValid,
					},
					logger: loggerMock,
					header: blockHeader,
					eventQueue: blockAfterExecuteContext.eventQueue,
					getStore: (moduleID: Buffer, prefix: Buffer) => stateStore.getStore(moduleID, prefix),
					getMethodContext: () => stressTestMethodContext,
					assets: { getAsset: jest.fn() },
					transaction: new Transaction({
						module: 'dex',
						command: 'removeLiquidty',
						fee: BigInt(5000000),
						nonce: BigInt(0),
						senderPublicKey: senderAddress,
						params: codec.encode(removeLiquiditySchema, {
							positionID: positionId,
							liquidityToRemove: BigInt(-5),
							amount0Min: BigInt(1000),
							amount1Min: BigInt(1000),
							maxTimestampValid,
						}),
						signatures: [utils.getRandomBytes(64)],
					}),
				});

				expect(tokenMethod.transfer).toHaveBeenCalledTimes(3);
				expect(tokenMethod.unlock).toHaveBeenCalledTimes(2);
				expect(
					(await dexModule.stores.get(PositionsStore).get(stressTestMethodContext, positionId))
						.liquidity,
				).toBe(positionsStoreData.liquidity + BigInt(-5));
				const events = blockAfterExecuteContext.eventQueue.getEvents();
				const validatorRemoveLiquidityEvents = events.filter(
					e => e.toObject().name === 'removeLiquidity',
				);
				expect(validatorRemoveLiquidityEvents).toHaveLength(1);
			});
		}
	});
});
