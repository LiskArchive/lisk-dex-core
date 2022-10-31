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
import { TokenMethod, TokenModule, VerifyStatus } from 'lisk-framework';
import { EventQueue } from 'lisk-framework/dist-node/state_machine';
import { createMethodContext, MethodContext } from 'lisk-framework/dist-node/state_machine/method_context';
import { PrefixedStateReadWriter } from 'lisk-framework/dist-node/state_machine/prefixed_state_read_writer';
import { createTransactionContext } from 'lisk-framework/dist-node/testing';
import { DexModule } from '../../../../src/app/modules';
import { CreatePoolCommand } from '../../../../src/app/modules/dex/commands/createPool';
import { MAX_TICK, MIN_TICK } from '../../../../src/app/modules/dex/constants';
import { AmountBelowMinEvent, FeesIncentivesCollectedEvent, PoolCreatedEvent, PositionCreatedEvent, PositionUpdateFailedEvent } from '../../../../src/app/modules/dex/events';

import { DexGlobalStore, PoolsStore, PositionsStore, PriceTicksStore } from '../../../../src/app/modules/dex/stores';
import { DexGlobalStoreData } from '../../../../src/app/modules/dex/stores/dexGlobalStore';
import { PoolsStoreData } from '../../../../src/app/modules/dex/stores/poolsStore';
import { PositionsStoreData } from '../../../../src/app/modules/dex/stores/positionsStore';
import { PriceTicksStoreData, tickToBytes } from '../../../../src/app/modules/dex/stores/priceTicksStore';
import { Address, PoolID, PositionID } from '../../../../src/app/modules/dex/types';
import { getPoolIDFromPositionID } from '../../../../src/app/modules/dex/utils/auxiliaryFunctions';
import { tickToPrice } from '../../../../src/app/modules/dex/utils/math';
import { numberToQ96, q96ToBytes } from '../../../../src/app/modules/dex/utils/q96';
import { InMemoryPrefixedStateDB } from './inMemoryPrefixedStateDB';
import { loggerMock } from 'lisk-framework/dist-node/testing/mocks';
import { SettingsStore, SettingsStoreData } from '../../../../src/app/modules/dex/stores/settingsStore';
import { TokenID } from 'lisk-framework/dist-node/modules/token/types';
import { hexToBytes } from '../../../../src/app/modules/dexRewards/constants';
import { createPoolSchema } from '../../../../src/app/modules/dex/schemas';

describe('dex:command:createPool', () => {
	// const dexModule = new DexModule();

	// const localTokenID = Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]);
	// const secondTokenID = Buffer.from([1, 0, 0, 0, 0, 0, 0, 0]);
	let command: CreatePoolCommand;
	let stateStore: PrefixedStateReadWriter;
	let methodContext: MethodContext;

	const tokenModule = new TokenModule();
	const senderAddress: Address = Buffer.from(hexToBytes('0x0000000000000000'));
	const positionId: PositionID = Buffer.from(hexToBytes('00000001000000000101643130'));

	const transferMock = jest.fn();
	const lockMock = jest.fn();

	const tokenMethod = new TokenMethod(tokenModule.stores, tokenModule.events, tokenModule.name);
	let poolsStore: PoolsStore;
	let priceTicksStore: PriceTicksStore;
	let dexGlobalStore: DexGlobalStore;
	let positionsStore: PositionsStore;
	let settingsStore: SettingsStore;
	// let interopAPI: {
	// 	getOwnChainAccount: jest.Mock;
	// 	send: jest.Mock;
	// 	error: jest.Mock;
	// 	terminateChain: jest.Mock;
	// 	getChannel: jest.Mock;
	// };
	stateStore = new PrefixedStateReadWriter(new InMemoryPrefixedStateDB());
	methodContext = createMethodContext({
		stateStore,
		eventQueue: new EventQueue(0),
	});

	const settings = {
		poolCreationSettings: [
			{
				feeTier: 100
			}
		]
	}

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

	const settingStoreData: SettingsStoreData = {
		protocolFeeAddress: Buffer.from(hexToBytes('0x0000000000000000')),
		protocolFeePart: 10,
		validatorsLSKRewardsPart: 5,
		poolCreationSettings: {
			feeTier: 1,
			tickSpacing: 1
		}
	}

	beforeEach(async () => {
		command = new CreatePoolCommand(tokenModule.stores, tokenModule.events);
		// interopAPI = {
		// 	getOwnChainAccount: jest.fn().mockResolvedValue({ id: Buffer.from([0, 0, 0, 1]) }),
		// 	send: jest.fn(),
		// 	error: jest.fn(),
		// 	terminateChain: jest.fn(),
		// 	getChannel: jest.fn(),
		// };
		tokenModule.stores.register(PoolsStore, new PoolsStore(DexModule.name));
		tokenModule.stores.register(PositionsStore, new PositionsStore(DexModule.name));
		tokenModule.stores.register(DexGlobalStore, new DexGlobalStore(DexModule.name));
		tokenModule.stores.register(PriceTicksStore, new PriceTicksStore(DexModule.name));
		tokenModule.stores.register(SettingsStore, new SettingsStore(DexModule.name));

		tokenModule.events.register(PositionUpdateFailedEvent, new PositionUpdateFailedEvent(DexModule.name));
		tokenModule.events.register(PositionCreatedEvent, new PositionCreatedEvent(DexModule.name));
		tokenModule.events.register(PoolCreatedEvent, new PoolCreatedEvent(DexModule.name));
		tokenModule.events.register(FeesIncentivesCollectedEvent, new FeesIncentivesCollectedEvent(DexModule.name));
		tokenModule.events.register(AmountBelowMinEvent, new AmountBelowMinEvent(DexModule.name));







		poolsStore = tokenModule.stores.get(PoolsStore);
		priceTicksStore = tokenModule.stores.get(PriceTicksStore);
		dexGlobalStore = tokenModule.stores.get(DexGlobalStore);
		positionsStore = tokenModule.stores.get(PositionsStore);
		settingsStore = tokenModule.stores.get(SettingsStore);


		const poolDataTokenID0 = Buffer.from('0000000100', 'hex');
		const poolDataTokenID1 = Buffer.from('0000000101', 'hex');
		const computePoolID = (tokenID0: TokenID, tokenID1: TokenID, feeTier: Buffer): PoolID =>
			Buffer.concat([tokenID0, tokenID1, feeTier])

		const poolID = computePoolID(poolDataTokenID0, poolDataTokenID1, Buffer.from([100]))
		await poolsStore.setKey(methodContext, [senderAddress, poolID], poolsStoreData);





		await dexGlobalStore.set(methodContext, Buffer.from([]), dexGlobalStoreData)
		await poolsStore.setKey(methodContext, [senderAddress, getPoolIDFromPositionID(positionId)], poolsStoreData);
		await poolsStore.set(methodContext, getPoolIDFromPositionID(positionId), poolsStoreData);



		await priceTicksStore.setKey(methodContext, [getPoolIDFromPositionID(positionId), tickToBytes(positionsStoreData.tickLower)], priceTicksStoreData)
		await priceTicksStore.setKey(methodContext, [getPoolIDFromPositionID(positionId), tickToBytes(positionsStoreData.tickUpper)], priceTicksStoreData)
		await priceTicksStore.setKey(methodContext, [getPoolIDFromPositionID(positionId), q96ToBytes(tickToPrice(positionsStoreData.tickLower))], priceTicksStoreData)
		await priceTicksStore.setKey(methodContext, [getPoolIDFromPositionID(positionId), q96ToBytes(tickToPrice(positionsStoreData.tickUpper))], priceTicksStoreData)

		await priceTicksStore.setKey(methodContext, [poolID, tickToBytes(positionsStoreData.tickLower)], priceTicksStoreData)
		await priceTicksStore.setKey(methodContext, [poolID, tickToBytes(positionsStoreData.tickUpper)], priceTicksStoreData)


		await positionsStore.set(methodContext, positionId, positionsStoreData);
		await positionsStore.setKey(methodContext, [senderAddress, positionId], positionsStoreData);


		await settingsStore.set(methodContext, Buffer.from([]), settingStoreData)


		tokenMethod.transfer = transferMock;
		tokenMethod.lock = lockMock;

		command.init({
			tokenMethod,
			stores: tokenModule.stores,
			events: tokenModule.events,
			senderAddress,
			methodContext,
			settings
		});
	});

	describe('verify', () => {
		it('should be successful when all the parameters are correct', async () => {
			const context = createTransactionContext({
				transaction: new Transaction({
					module: 'dex',
					command: 'createPool',
					fee: BigInt(5000000),
					nonce: BigInt(0),
					senderPublicKey: utils.getRandomBytes(32),
					params: codec.encode(createPoolSchema, {
						tokenID0: Buffer.from('0000000100', 'hex'),
						tokenID1: Buffer.from('0000000101', 'hex'),
						feeTier: 100,
						tickInitialPrice: 1,
						initialPosition: {
							tickLower: MIN_TICK,
							tickUpper: MAX_TICK,
							amount0Desired: BigInt(1000),
							amount1Desired: BigInt(1000),
						},
						maxTimestampValid: BigInt(1000)
					}),
					signatures: [utils.getRandomBytes(64)],
				}),
			});
			const result = await command.verify(context.createCommandVerifyContext(createPoolSchema));

			expect(result.error?.message).not.toBeDefined();
			expect(result.status).toEqual(VerifyStatus.OK);
		});


		it('should fail when tokenID0 and tokenID1 are not sorted lexicographically', async () => {
			const context = createTransactionContext({
				transaction: new Transaction({
					module: 'dex',
					command: 'createPool',
					fee: BigInt(5000000),
					nonce: BigInt(0),
					senderPublicKey: utils.getRandomBytes(32),
					params: codec.encode(createPoolSchema, {
						tokenID0: Buffer.from('0000000101', 'hex'),
						tokenID1: Buffer.from('0000000100', 'hex'),
						feeTier: 100,
						tickInitialPrice: 1,
						initialPosition: {
							tickLower: MIN_TICK,
							tickUpper: MAX_TICK,
							amount0Desired: BigInt(1000),
							amount1Desired: BigInt(1000),
						},
						maxTimestampValid: BigInt(1000)
					}),
					signatures: [utils.getRandomBytes(64)],
				}),
			});
			const result = await command.verify(context.createCommandVerifyContext(createPoolSchema));

			expect(result.error?.message).toBe('Please sort tokenID0 and tokenID1 lexicographically');
			expect(result.status).toEqual(VerifyStatus.FAIL);
		});


		it('should fail when amount0Desired or amount1Desired are zero', async () => {
			const context = createTransactionContext({
				transaction: new Transaction({
					module: 'dex',
					command: 'createPool',
					fee: BigInt(5000000),
					nonce: BigInt(0),
					senderPublicKey: utils.getRandomBytes(32),
					params: codec.encode(createPoolSchema, {
						tokenID0: Buffer.from('0000000100', 'hex'),
						tokenID1: Buffer.from('0000000101', 'hex'),
						feeTier: 100,
						tickInitialPrice: 1,
						initialPosition: {
							tickLower: MIN_TICK,
							tickUpper: MAX_TICK,
							amount0Desired: BigInt(0),
							amount1Desired: BigInt(0),
						},
						maxTimestampValid: BigInt(1000)
					}),
					signatures: [utils.getRandomBytes(64)],
				}),
			});
			const result = await command.verify(context.createCommandVerifyContext(createPoolSchema));

			expect(result.error?.message).toBe('Please specify amount0Desired or amount1Desired');
			expect(result.status).toEqual(VerifyStatus.FAIL);
		});


		it('should fail when tickLower and tickUpper do not meet requirements', async () => {
			const context = createTransactionContext({
				transaction: new Transaction({
					module: 'dex',
					command: 'createPool',
					fee: BigInt(5000000),
					nonce: BigInt(0),
					senderPublicKey: utils.getRandomBytes(32),
					params: codec.encode(createPoolSchema, {
						tokenID0: Buffer.from('0000000100', 'hex'),
						tokenID1: Buffer.from('0000000101', 'hex'),
						feeTier: 100,
						tickInitialPrice: 1,
						initialPosition: {
							tickLower: MIN_TICK - 10,
							tickUpper: MAX_TICK + 10,
							amount0Desired: BigInt(1000),
							amount1Desired: BigInt(1000),
						},
						maxTimestampValid: BigInt(1000)
					}),
					signatures: [utils.getRandomBytes(64)],
				}),
			});
			const result = await command.verify(context.createCommandVerifyContext(createPoolSchema));

			expect(result.error?.message).toBe('Please specify valid tick values');
			expect(result.status).toEqual(VerifyStatus.FAIL);
		});
	});

	describe('execute', async () => {
		it('should create Pool', async () => {
			await expect(
				command.execute({
					chainID: utils.getRandomBytes(32),
					params: {
						tokenID0: Buffer.from('0000000100', 'hex'),
						tokenID1: Buffer.from('0000000101', 'hex'),
						feeTier: 100,
						tickInitialPrice: 1,
						initialPosition: {
							tickLower: -8,
							tickUpper: -5,
							amount0Desired: BigInt(79228162514264337593543950335000),
							amount1Desired: BigInt(1000),
						},
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
						command: 'createPool',
						fee: BigInt(5000000),
						nonce: BigInt(0),
						senderPublicKey: utils.getRandomBytes(32),
						params: codec.encode(createPoolSchema, {
							tokenID0: Buffer.from('0000000100', 'hex'),
							tokenID1: Buffer.from('0000000101', 'hex'),
							feeTier: 100,
							tickInitialPrice: 1,
							initialPosition: {
								tickLower: -8,
								tickUpper: -5,
								amount0Desired: BigInt(79228162514264337593543950335000),
								amount1Desired: BigInt(1000),
							},
							maxTimestampValid: BigInt(1000)
						}),
						signatures: [utils.getRandomBytes(64)],
					}),
				})
			).resolves.toBeUndefined();

		});
	})

});