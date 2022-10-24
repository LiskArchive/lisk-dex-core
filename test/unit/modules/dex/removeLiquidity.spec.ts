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
import {  TokenMethod, TokenModule, VerifyStatus } from 'lisk-framework';
import {  createMethodContext, EventQueue, MethodContext } from 'lisk-framework/dist-node/state_machine';
import { PrefixedStateReadWriter } from 'lisk-framework/dist-node/state_machine/prefixed_state_read_writer';
import { createTransactionContext } from 'lisk-framework/dist-node/testing';
import { DexModule } from '../../../../src/app/modules';
import { RemoveLiquidityCommand } from '../../../../src/app/modules/dex/commands/removeLiquidity';
import { removeLiquiditySchema } from '../../../../src/app/modules/dex/schemas';

import { InMemoryPrefixedStateDB } from './in_memory_prefixed_state';
import { loggerMock } from 'lisk-framework/dist-node/testing/mocks';
import { PoolCreatedEvent, PositionCreatedEvent, PositionUpdateFailedEvent } from '../../../../src/app/modules/dex/events';
import { PoolsStore, PositionsStore } from '../../../../src/app/modules/dex/stores';
import { PositionsStoreData } from '../../../../src/app/modules/dex/stores/positionsStore';
import { numberToQ96, q96ToBytes } from '../../../../src/app/modules/dex/utils/q96';
import { Address, PositionID } from '../../../../src/app/modules/dex/types';
import { hexToBytes } from '../../../../src/app/modules/dex/constants';
import { PoolsStoreData } from '../../../../src/app/modules/dex/stores/poolsStore';
import { getPoolIDFromPositionID } from '../../../../src/app/modules/dex/utils/auxiliaryFunctions';
import { DexGlobalStore, DexGlobalStoreData } from '../../../../src/app/modules/dex/stores/dexGlobalStore';
import { PriceTicksStore, PriceTicksStoreData, tickToBytes } from '../../../../src/app/modules/dex/stores/priceTicksStore';

describe('dex:command:removeLiquidity', () => {
	//const dexModule = new DexModule();
	let command: RemoveLiquidityCommand;
	let stateStore: PrefixedStateReadWriter;
	let methodContext: MethodContext;

	const tokenModule = new TokenModule();
	const senderAddress: Address = Buffer.from(hexToBytes('0x0000000000000000'));
	const positionId: PositionID = Buffer.from(hexToBytes('0x000000000000000000000001000000000000c8'));

	
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
		liquidity: BigInt(1000),
		sqrtPrice: q96ToBytes(BigInt(1)),
		feeGrowthGlobal0: q96ToBytes(numberToQ96(BigInt(0))),
		feeGrowthGlobal1: q96ToBytes(numberToQ96(BigInt(0))),
		tickSpacing: 1
	}
	const priceTicksStoreData: PriceTicksStoreData = {
		liquidityNet: BigInt(0),
		liquidityGross: BigInt(0),
		feeGrowthOutside0: q96ToBytes(numberToQ96(BigInt(0))),
		feeGrowthOutside1: q96ToBytes(numberToQ96(BigInt(0))),
	}

	const dexGlobalStoreData: DexGlobalStoreData = {
		positionCounter: BigInt(1),
		collectableLSKFees: BigInt(1),
	}
	const positionsStoreData: PositionsStoreData = {
		tickLower: -887,
		tickUpper: -886,
		liquidity: BigInt(300),
		feeGrowthInsideLast0: q96ToBytes(numberToQ96(BigInt(0))),
		feeGrowthInsideLast1: q96ToBytes(numberToQ96(BigInt(0))),
		ownerAddress: senderAddress
	}
	


	beforeEach(async () => {
		command = new RemoveLiquidityCommand(tokenModule.stores, tokenModule.events);
		command.init({
			tokenMethod,
			stores: tokenModule.stores,
			events: tokenModule.events,
			senderAddress
		});

		tokenModule.stores.register(PoolsStore, new PoolsStore(DexModule.name));
			tokenModule.stores.register(PositionsStore, new PositionsStore(DexModule.name));
			tokenModule.stores.register(DexGlobalStore, new DexGlobalStore(DexModule.name));
			tokenModule.stores.register(PriceTicksStore, new PriceTicksStore(DexModule.name));
			tokenModule.events.register(PositionUpdateFailedEvent, new PositionUpdateFailedEvent(DexModule.name));
			tokenModule.events.register(PositionCreatedEvent, new PositionCreatedEvent(DexModule.name));
			tokenModule.events.register(PoolCreatedEvent, new PoolCreatedEvent(DexModule.name));

			poolsStore = tokenModule.stores.get(PoolsStore);
			priceTicksStore = tokenModule.stores.get(PriceTicksStore);
			dexGlobalStore = tokenModule.stores.get(DexGlobalStore);
			positionsStore = tokenModule.stores.get(PositionsStore);

			await dexGlobalStore.set(methodContext, Buffer.from([]), dexGlobalStoreData)
			await poolsStore.setKey(methodContext, [senderAddress, getPoolIDFromPositionID(positionId)], poolsStoreData);
			await poolsStore.set(methodContext, getPoolIDFromPositionID(positionId), poolsStoreData);
			await priceTicksStore.setKey(methodContext, [getPoolIDFromPositionID(positionId), tickToBytes(positionsStoreData.tickLower)], priceTicksStoreData)
			await priceTicksStore.setKey(methodContext, [getPoolIDFromPositionID(positionId), tickToBytes(positionsStoreData.tickUpper)], priceTicksStoreData)
			await positionsStore.set(methodContext, positionId, positionsStoreData);
			await positionsStore.setKey(methodContext, [senderAddress, positionId], positionsStoreData);
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
						positionID:Buffer.from('0000000100', 'hex'),
                        liquidityToRemove:BigInt(250),
                        amount0Min:BigInt(1000),
                        amount1Min:BigInt(1000),
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

	describe('execute', () =>{
		it('should terminate and throw error if the positionID is not same as the postionStoreData', async()=>{
			expect(
				command.execute({
					chainID: utils.getRandomBytes(32),
					params: {
						positionID:Buffer.from('0000000100', 'hex'),
						liquidityToRemove: BigInt(250),
						amount0Min: BigInt(1000),
						amount1Min: BigInt(1000),
						maxTimestampValid: BigInt(1000)
					},
					logger: loggerMock,
					eventQueue: new EventQueue(0),
					getStore: (moduleID: Buffer, prefix: Buffer) => stateStore.getStore(moduleID, prefix),
					getMethodContext: () => methodContext,
					assets: {getAsset: jest.fn()},
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
							positionID:Buffer.from('0000000100', 'hex'),
							liquidityToRemove:BigInt(250),
							amount0Min:BigInt(1000),
							amount1Min:BigInt(1000),
							maxTimestampValid: BigInt(1000)
						}),
						signatures: [utils.getRandomBytes(64)],
					}),
				}),
			).resolves.toBeUndefined();
		});
	});

	describe('execute', () =>{
		it('should terminate and throw error if the liquidityToRemove > totalLiquiidty', async()=>{
			expect(
				command.execute({
					chainID: utils.getRandomBytes(32),
					params: {
						positionID:Buffer.from('0000000100', 'hex'),
						liquidityToRemove: BigInt(350),
						amount0Min: BigInt(1000),
						amount1Min: BigInt(1000),
						maxTimestampValid: BigInt(1000)
					},
					logger: loggerMock,
					eventQueue: new EventQueue(0),
					getStore: (moduleID: Buffer, prefix: Buffer) => stateStore.getStore(moduleID, prefix),
					getMethodContext: () => methodContext,
					assets: {getAsset: jest.fn()},
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
							positionID:Buffer.from('0000000100', 'hex'),
							liquidityToRemove:BigInt(250),
							amount0Min:BigInt(1000),
							amount1Min:BigInt(1000),
							maxTimestampValid: BigInt(1000)
						}),
						signatures: [utils.getRandomBytes(64)],
					}),
				}),
			).resolves.toBeUndefined();
		});
	})

	describe('execute', () =>{
		it('should remove liquidity from an existing position', async()=>{
			expect(
				command.execute({
					chainID: utils.getRandomBytes(32),
					params: {
						positionID: positionId,
						liquidityToRemove: BigInt(250),
						amount0Min: BigInt(1000),
						amount1Min: BigInt(1000),
						maxTimestampValid: BigInt(1000)
					},
					logger: loggerMock,
					eventQueue: new EventQueue(0),
					getStore: (moduleID: Buffer, prefix: Buffer) => stateStore.getStore(moduleID, prefix),
					getMethodContext: () => methodContext,
					assets: {getAsset: jest.fn()},
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
							positionID:Buffer.from('0000000100', 'hex'),
							liquidityToRemove:BigInt(250),
							amount0Min:BigInt(1000),
							amount1Min:BigInt(1000),
							maxTimestampValid: BigInt(1000)
						}),
						signatures: [utils.getRandomBytes(64)],
					}),
				}),
			).resolves.toBeUndefined();
		});
	})
});