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
import { TokenMethod, TokenModule } from 'lisk-framework';
import { createMethodContext, EventQueue, MethodContext, VerifyStatus } from 'lisk-framework/dist-node/state_machine';
import { PrefixedStateReadWriter } from 'lisk-framework/dist-node/state_machine/prefixed_state_read_writer';
import { DexModule } from '../../../../src/app/modules';
import { RemoveLiquidityCommand } from '../../../../src/app/modules/dex/commands/removeLiquidity';
import { removeLiquiditySchema } from '../../../../src/app/modules/dex/schemas';


import { loggerMock } from 'lisk-framework/dist-node/testing/mocks';
import { FeesIncentivesCollectedEvent, PoolCreatedEvent, PositionCreatedEvent, PositionUpdateFailedEvent } from '../../../../src/app/modules/dex/events';
import { PoolsStore, PositionsStore } from '../../../../src/app/modules/dex/stores';
import { PositionsStoreData } from '../../../../src/app/modules/dex/stores/positionsStore';
import { numberToQ96, q96ToBytes } from '../../../../src/app/modules/dex/utils/q96';
import { Address, PositionID } from '../../../../src/app/modules/dex/types';
import { PoolsStoreData } from '../../../../src/app/modules/dex/stores/poolsStore';
import { getPoolIDFromPositionID } from '../../../../src/app/modules/dex/utils/auxiliaryFunctions';
import { DexGlobalStore, DexGlobalStoreData } from '../../../../src/app/modules/dex/stores/dexGlobalStore';
import { PriceTicksStore, PriceTicksStoreData, tickToBytes } from '../../../../src/app/modules/dex/stores/priceTicksStore';
import { InMemoryPrefixedStateDB } from './inMemoryPrefixedStateDB';
import { tickToPrice } from '../../../../src/app/modules/dex/utils/math';
import { RemoveLiquidityFailedEvent } from '../../../../src/app/modules/dex/events/removeLiquidityFailed';
import { RemoveLiquidityEvent } from '../../../../src/app/modules/dex/events/removeLiquidity';
import { createTransactionContext } from 'lisk-framework/dist-node/testing';

describe('dex:command:removeLiquidity', () => {
	//const dexModule = new DexModule();
	let command: RemoveLiquidityCommand;
	let stateStore: PrefixedStateReadWriter;
	let methodContext: MethodContext;

	const tokenModule = new TokenModule();
	const senderAddress: Address = Buffer.from('0000000000000000');
	const positionId: PositionID = Buffer.from('00000001000000000101643130');
	const liquidityToRemove: bigint = BigInt(-2);

	const transferMock = jest.fn();
	const lockMock = jest.fn();
	const unlockMock = jest.fn();

	const tokenMethod = new TokenMethod(tokenModule.stores, tokenModule.events, tokenModule.name);
	let poolsStore: PoolsStore;
	let priceTicksStore: PriceTicksStore;
	let dexGlobalStore: DexGlobalStore;
	let positionsStore: PositionsStore;

	stateStore = new PrefixedStateReadWriter(new InMemoryPrefixedStateDB());
	methodContext = createMethodContext({
		stateStore,
		eventQueue: new EventQueue(0),
	});

	const poolsStoreData: PoolsStoreData = {
		liquidity: BigInt(5),
		sqrtPrice: q96ToBytes(BigInt(1)),
		feeGrowthGlobal0: q96ToBytes(numberToQ96(BigInt(1))),
		feeGrowthGlobal1: q96ToBytes(numberToQ96(BigInt(1))),
		tickSpacing: 1
	}
	const priceTicksStoreData: PriceTicksStoreData = {
		liquidityNet: BigInt(5),
		liquidityGross: BigInt(5),
		feeGrowthOutside0: q96ToBytes(numberToQ96(BigInt(1))),
		feeGrowthOutside1: q96ToBytes(numberToQ96(BigInt(1))),
	}

	const dexGlobalStoreData: DexGlobalStoreData = {
		positionCounter: BigInt(10),
		collectableLSKFees: BigInt(10),
	}
	const positionsStoreData: PositionsStoreData = {
		tickLower: -8,
		tickUpper: -5,
		liquidity: BigInt(5),
		feeGrowthInsideLast0: q96ToBytes(numberToQ96(BigInt(0))),
		feeGrowthInsideLast1: q96ToBytes(numberToQ96(BigInt(0))),
		ownerAddress: senderAddress
	}



	beforeEach(async () => {
		command = new RemoveLiquidityCommand(tokenModule.stores, tokenModule.events);



		tokenModule.stores.register(PoolsStore, new PoolsStore(DexModule.name));
		tokenModule.stores.register(PositionsStore, new PositionsStore(DexModule.name));
		tokenModule.stores.register(DexGlobalStore, new DexGlobalStore(DexModule.name));
		tokenModule.stores.register(PriceTicksStore, new PriceTicksStore(DexModule.name));
		tokenModule.events.register(PositionUpdateFailedEvent, new PositionUpdateFailedEvent(DexModule.name));
		tokenModule.events.register(PositionCreatedEvent, new PositionCreatedEvent(DexModule.name));
		tokenModule.events.register(PoolCreatedEvent, new PoolCreatedEvent(DexModule.name));
		tokenModule.events.register(FeesIncentivesCollectedEvent, new FeesIncentivesCollectedEvent(DexModule.name));
		tokenModule.events.register(RemoveLiquidityFailedEvent, new RemoveLiquidityFailedEvent(DexModule.name));
		tokenModule.events.register(RemoveLiquidityEvent, new RemoveLiquidityEvent(DexModule.name));



		poolsStore = tokenModule.stores.get(PoolsStore);
		priceTicksStore = tokenModule.stores.get(PriceTicksStore);
		dexGlobalStore = tokenModule.stores.get(DexGlobalStore);
		positionsStore = tokenModule.stores.get(PositionsStore);

		await dexGlobalStore.set(methodContext, Buffer.from([]), dexGlobalStoreData)
		await poolsStore.setKey(methodContext, [senderAddress, getPoolIDFromPositionID(positionId)], poolsStoreData);
		await poolsStore.set(methodContext, getPoolIDFromPositionID(positionId), poolsStoreData);
		await priceTicksStore.setKey(methodContext, [getPoolIDFromPositionID(positionId), tickToBytes(positionsStoreData.tickLower)], priceTicksStoreData)
		await priceTicksStore.setKey(methodContext, [getPoolIDFromPositionID(positionId), tickToBytes(positionsStoreData.tickUpper)], priceTicksStoreData)
		await priceTicksStore.setKey(methodContext, [getPoolIDFromPositionID(positionId), q96ToBytes(tickToPrice(positionsStoreData.tickLower))], priceTicksStoreData)
		await priceTicksStore.setKey(methodContext, [getPoolIDFromPositionID(positionId), q96ToBytes(tickToPrice(positionsStoreData.tickUpper))], priceTicksStoreData)

		await positionsStore.set(methodContext, positionId, positionsStoreData);
		await positionsStore.setKey(methodContext, [senderAddress, positionId], positionsStoreData);

		tokenMethod.transfer = transferMock;
		tokenMethod.lock = lockMock;
		tokenMethod.unlock = unlockMock;

		command.init({
			tokenMethod,
			stores: tokenModule.stores,
			events: tokenModule.events,
			senderAddress,
			methodContext
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
						positionID: Buffer.from('0000000100', 'hex'),
						liquidityToRemove: BigInt(250),
						amount0Min: BigInt(1000),
						amount1Min: BigInt(1000),
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

	describe('execute', () => {
		it('should terminate and throw error if the positionID is not same as positionsStore doesnt have position with the specified positionID', async () => {
			await expect(
				command.execute({
					chainID: utils.getRandomBytes(32),
					params: {
						positionID: Buffer.from('0000000100', 'hex'),
						liquidityToRemove: liquidityToRemove,
						amount0Min: BigInt(1000),
						amount1Min: BigInt(1000),
						maxTimestampValid: BigInt(1000)
					},
					logger: loggerMock,
					eventQueue: new EventQueue(0),
					getStore: (moduleID: Buffer, prefix: Buffer) => stateStore.getStore(moduleID, prefix),
					getMethodContext: () => methodContext,
					assets: { getAsset: jest.fn() },
					currentValidators: [],
					impliesMaxPrevote: false,
					maxHeightCertified: Number(10),
					certificateThreshold: BigInt(2),
					transaction: new Transaction({
						module: 'dex',
						command: 'removeLiquidty',
						fee: BigInt(5000000),
						nonce: BigInt(0),
						senderPublicKey: utils.getRandomBytes(32),
						params: codec.encode(removeLiquiditySchema, {
							positionID: Buffer.from('0000000100', 'hex'),
							liquidityToRemove: liquidityToRemove,
							amount0Min: BigInt(1000),
							amount1Min: BigInt(1000),
							maxTimestampValid: BigInt(1000)
						}),
						signatures: [utils.getRandomBytes(64)],
					}),
				}),
			).rejects.toThrowError();
		});
	});

	describe('execute', () => {
		it('should terminate and throw error if the liquidityToRemove > totalLiquiidty', async () => {
			await expect(
				command.execute({
					chainID: utils.getRandomBytes(32),
					params: {
						positionID: positionId,
						liquidityToRemove: BigInt(-10),
						amount0Min: BigInt(0),
						amount1Min: BigInt(0),
						maxTimestampValid: BigInt(1000)
					},
					logger: loggerMock,
					eventQueue: new EventQueue(0),
					getStore: (moduleID: Buffer, prefix: Buffer) => stateStore.getStore(moduleID, prefix),
					getMethodContext: () => methodContext,
					assets: { getAsset: jest.fn() },
					currentValidators: [],
					impliesMaxPrevote: false,
					maxHeightCertified: Number(10),
					certificateThreshold: BigInt(2),
					transaction: new Transaction({
						module: 'dex',
						command: 'removeLiquidty',
						fee: BigInt(5000000),
						nonce: BigInt(0),
						senderPublicKey: utils.getRandomBytes(32),
						params: codec.encode(removeLiquiditySchema, {
							positionID: positionId,
							liquidityToRemove: BigInt(-10),
							amount0Min: BigInt(1000),
							amount1Min: BigInt(1000),
							maxTimestampValid: BigInt(1000)
						}),
						signatures: [utils.getRandomBytes(64)],
					}),
				}),
			).rejects.toThrowError();
		});
	})

	describe('execute', () => {

		it('should remove liquidity from an existing position', async () => {
			await expect(
				command.execute({
					chainID: utils.getRandomBytes(32),
					params: {
						positionID: positionId,
						liquidityToRemove: liquidityToRemove,
						amount0Min: BigInt(0),
						amount1Min: BigInt(0),
						maxTimestampValid: BigInt(1000)
					},
					logger: loggerMock,
					eventQueue: new EventQueue(0),
					getStore: (moduleID: Buffer, prefix: Buffer) => stateStore.getStore(moduleID, prefix),
					getMethodContext: () => methodContext,
					assets: { getAsset: jest.fn() },
					currentValidators: [],
					impliesMaxPrevote: false,
					maxHeightCertified: Number(10),
					certificateThreshold: BigInt(2),
					transaction: new Transaction({
						module: 'dex',
						command: 'removeLiquidty',
						fee: BigInt(5000000),
						nonce: BigInt(0),
						senderPublicKey: utils.getRandomBytes(32),
						params: codec.encode(removeLiquiditySchema, {
							positionID: positionId,
							liquidityToRemove: liquidityToRemove,
							amount0Min: BigInt(1000),
							amount1Min: BigInt(1000),
							maxTimestampValid: BigInt(1000)
						}),
						signatures: [utils.getRandomBytes(64)],
					}),
				})
			).resolves.toBeUndefined();
			expect(tokenMethod.transfer).toBeCalledTimes(3);
			expect(tokenMethod.unlock).toBeCalledTimes(2);
			expect((await tokenModule.stores.get(PositionsStore).get(methodContext, positionId)).liquidity).toBe(positionsStoreData.liquidity + liquidityToRemove);
		});
	})

	describe('execute', () => {
		it('should throw Error as amount1Min > amount1', async () => {
			await expect(
				command.execute({
					chainID: utils.getRandomBytes(32),
					params: {
						positionID: positionId,
						liquidityToRemove: liquidityToRemove,
						amount0Min: BigInt(0),
						amount1Min: BigInt(1000),
						maxTimestampValid: BigInt(1000)
					},
					logger: loggerMock,
					eventQueue: new EventQueue(0),
					getStore: (moduleID: Buffer, prefix: Buffer) => stateStore.getStore(moduleID, prefix),
					getMethodContext: () => methodContext,
					assets: { getAsset: jest.fn() },
					currentValidators: [],
					impliesMaxPrevote: false,
					maxHeightCertified: Number(10),
					certificateThreshold: BigInt(2),
					transaction: new Transaction({
						module: 'dex',
						command: 'removeLiquidty',
						fee: BigInt(5000000),
						nonce: BigInt(0),
						senderPublicKey: utils.getRandomBytes(32),
						params: codec.encode(removeLiquiditySchema, {
							positionID: positionId,
							liquidityToRemove: liquidityToRemove,
							amount0Min: BigInt(1000),
							amount1Min: BigInt(1000),
							maxTimestampValid: BigInt(1000)
						}),
						signatures: [utils.getRandomBytes(64)],
					}),
				}),
			).rejects.toThrowError('Update position amounts are more then minimum amounts');
		});
	})

	describe('execute', () => {
		it('should throw Error as amount0Min > amount0', async () => {
			await expect(
				command.execute({
					chainID: utils.getRandomBytes(32),
					params: {
						positionID: positionId,
						liquidityToRemove: liquidityToRemove,
						amount0Min: BigInt(158456325028528675187087900671),
						amount1Min: BigInt(0),
						maxTimestampValid: BigInt(1000)
					},
					logger: loggerMock,
					eventQueue: new EventQueue(0),
					getStore: (moduleID: Buffer, prefix: Buffer) => stateStore.getStore(moduleID, prefix),
					getMethodContext: () => methodContext,
					assets: { getAsset: jest.fn() },
					currentValidators: [],
					impliesMaxPrevote: false,
					maxHeightCertified: Number(10),
					certificateThreshold: BigInt(2),
					transaction: new Transaction({
						module: 'dex',
						command: 'removeLiquidty',
						fee: BigInt(5000000),
						nonce: BigInt(0),
						senderPublicKey: utils.getRandomBytes(32),
						params: codec.encode(removeLiquiditySchema, {
							positionID: positionId,
							liquidityToRemove: liquidityToRemove,
							amount0Min: BigInt(1000),
							amount1Min: BigInt(1000),
							maxTimestampValid: BigInt(1000)
						}),
						signatures: [utils.getRandomBytes(64)],
					}),
				})
			).rejects.toThrowError('Update position amounts are more then minimum amounts');
		});
	})
});