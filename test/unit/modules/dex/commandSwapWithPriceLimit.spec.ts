/* eslint-disable import/no-cycle */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
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

import { codec, Transaction, cryptography, testing, TokenMethod } from 'lisk-sdk';
import {
	createMethodContext,
	EventQueue,
	MethodContext,
	VerifyStatus,
} from 'lisk-framework/dist-node/state_machine';
import { TokenID } from 'lisk-framework/dist-node/modules/token/types';
import { loggerMock } from 'lisk-framework/dist-node/testing/mocks';
import { createFakeBlockHeader } from 'lisk-framework/dist-node/testing';
import { DexModule } from '../../../../src/app/modules';

import { Address, PoolID } from '../../../../src/app/modules/dex/types';

import { PrefixedStateReadWriter } from '../../../stateMachine/prefixedStateReadWriter';
import { InMemoryPrefixedStateDB } from './inMemoryPrefixedState';

import { PoolsStore, PoolsStoreData } from '../../../../src/app/modules/dex/stores/poolsStore';
import { bytesToQ96, numberToQ96, q96ToBytes } from '../../../../src/app/modules/dex/utils/q96';
import { priceToTick, tickToPrice } from '../../../../src/app/modules/dex/utils/math';
import { NUM_BYTES_POOL_ID } from '../../../../src/app/modules/dex/constants';
import { DexGlobalStore, PriceTicksStore } from '../../../../src/app/modules/dex/stores';
import {
	PriceTicksStoreData,
	tickToBytes,
} from '../../../../src/app/modules/dex/stores/priceTicksStore';
import { DexGlobalStoreData } from '../../../../src/app/modules/dex/stores/dexGlobalStore';
import { SwapExactWithPriceLimitCommand } from '../../../../src/app/modules/dex/commands/swapWithPriceLimit';
import { swapWithPriceLimitCommandSchema } from '../../../../src/app/modules/dex/schemas';

const { utils } = cryptography;
const { createTransactionContext } = testing;

describe('swapEactIn', () => {
	let command: SwapExactWithPriceLimitCommand;
	const dexModule = new DexModule();

	const transferMock = jest.fn();
	const lockMock = jest.fn();
	const unlockMock = jest.fn();

	let poolsStore: PoolsStore;
	let dexGlobalStore: DexGlobalStore;
	let priceTicksStore: PriceTicksStore;

	const senderAddress: Address = Buffer.from('0000000000000000', 'hex');
	const poolID: PoolID = Buffer.from('0000000000000000000001000000000000c8', 'hex');
	const poolIDLSK = Buffer.from('0000000100000000', 'hex');

	const tokenIdIn: TokenID = Buffer.from('0000000000000000', 'hex');
	const tokenIdOut: TokenID = Buffer.from('0000010000000000', 'hex');
	const inMemoryPrefixedStateDB = new InMemoryPrefixedStateDB();
	const stateStore: PrefixedStateReadWriter = new PrefixedStateReadWriter(inMemoryPrefixedStateDB);
	const tokenMethod = new TokenMethod(dexModule.stores, dexModule.events, dexModule.name);

	const methodContext: MethodContext = createMethodContext({
		contextStore: new Map(),
		stateStore,
		eventQueue: new EventQueue(0),
	});

	const poolsStoreData: PoolsStoreData = {
		liquidity: BigInt(5000000),
		sqrtPrice: q96ToBytes(BigInt(tickToPrice(100))),
		incentivesPerLiquidityAccumulator: q96ToBytes(numberToQ96(BigInt(10))),
		heightIncentivesUpdate: 5,
		feeGrowthGlobal0: q96ToBytes(numberToQ96(BigInt(10))),
		feeGrowthGlobal1: q96ToBytes(numberToQ96(BigInt(10))),
		tickSpacing: 1,
	};

	const dexGlobalStoreData: DexGlobalStoreData = {
		positionCounter: BigInt(15),
		collectableLSKFees: BigInt(10),
		poolCreationSettings: [{ feeTier: 100, tickSpacing: 1 }],
		incentivizedPools: [{ poolId: poolID, multiplier: 10 }],
		totalIncentivesMultiplier: 1,
	};

	const priceTicksStoreDataTickUpper: PriceTicksStoreData = {
		liquidityNet: BigInt(5),
		liquidityGross: BigInt(5),
		feeGrowthOutside0: q96ToBytes(numberToQ96(BigInt(5))),
		feeGrowthOutside1: q96ToBytes(numberToQ96(BigInt(5))),
		incentivesPerLiquidityOutside: q96ToBytes(numberToQ96(BigInt(3))),
	};

	beforeEach(async () => {
		command = new SwapExactWithPriceLimitCommand(dexModule.stores, dexModule.events);

		poolsStore = dexModule.stores.get(PoolsStore);
		dexGlobalStore = dexModule.stores.get(DexGlobalStore);
		priceTicksStore = dexModule.stores.get(PriceTicksStore);

		await poolsStore.setKey(methodContext, [poolID], poolsStoreData);
		await poolsStore.setKey(methodContext, [poolIDLSK], poolsStoreData);

		await dexGlobalStore.set(methodContext, Buffer.from([]), dexGlobalStoreData);

		tokenMethod.transfer = transferMock;
		tokenMethod.lock = lockMock;
		tokenMethod.unlock = unlockMock;

		const currentTick = priceToTick(bytesToQ96(poolsStoreData.sqrtPrice));
		const currentTickID = q96ToBytes(BigInt(currentTick));
		const poolIDAndTickID = Buffer.concat([poolID, tickToBytes(currentTick)]);
		await priceTicksStore.setKey(methodContext, [poolIDAndTickID], priceTicksStoreDataTickUpper);
		await poolsStore.setKey(
			methodContext,
			[currentTickID.slice(0, NUM_BYTES_POOL_ID)],
			poolsStoreData,
		);

		await priceTicksStore.setKey(methodContext, [currentTickID], priceTicksStoreDataTickUpper);
		await priceTicksStore.setKey(
			methodContext,
			[Buffer.from(poolID.toLocaleString() + tickToBytes(100).toLocaleString(), 'hex')],
			priceTicksStoreDataTickUpper,
		);

		await priceTicksStore.setKey(
			methodContext,
			[Buffer.from('000000000000000000000000000000000000000000000006', 'hex')],
			priceTicksStoreDataTickUpper,
		);

		command.init({
			tokenMethod,
		});
	});

	describe('verify', () => {
		it('should be successful when all the parameters are correct', async () => {
			const context = createTransactionContext({
				transaction: new Transaction({
					module: 'dex',
					command: 'swapExactIn',
					fee: BigInt(5000000),
					nonce: BigInt(0),
					senderPublicKey: senderAddress,
					params: codec.encode(swapWithPriceLimitCommandSchema, {
						tokenIdIn,
						maxAmountTokenIn: BigInt(250),
						tokenIdOut,
						minAmountTokenOut: BigInt(10),
						poolId: poolID,
						maxTimestampValid: BigInt(5),
						sqrtLimitPrice: BigInt(4295128735),
					}),
					signatures: [utils.getRandomBytes(64)],
				}),
			});
			const result = await command.verify(
				context.createCommandVerifyContext(swapWithPriceLimitCommandSchema),
			);
			expect(result.error?.message).toBeUndefined();
			expect(result.status).toEqual(VerifyStatus.OK);
		});
	});

	describe('execute block should be succesful', () => {
		it('should be a successful swap', async () => {
			await expect(
				command.execute({
					contextStore: new Map(),
					stateStore,
					chainID: utils.getRandomBytes(32),
					params: {
						tokenIdIn,
						maxAmountTokenIn: BigInt(250),
						tokenIdOut,
						minAmountTokenOut: BigInt(10),
						poolId: poolID,
						maxTimestampValid: BigInt(5),
						sqrtLimitPrice: BigInt(4295128735),
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
						params: codec.encode(swapWithPriceLimitCommandSchema, {
							tokenIdIn,
							maxAmountTokenIn: BigInt(250),
							tokenIdOut,
							minAmountTokenOut: BigInt(10),
							poolId: poolID,
							maxTimestampValid: BigInt(5),
							sqrtLimitPrice: BigInt(4295128735),
						}),
						signatures: [utils.getRandomBytes(64)],
					}),
				}),
			).resolves.toBeUndefined();
		});
	});
});
