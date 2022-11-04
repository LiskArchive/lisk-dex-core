/* eslint-disable import/no-cycle */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/*
 * Copyright © 2022 Lisk Foundation
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
	getToken0Id,
	getToken1Id,
	getFeeTier,
	getPoolIDFromPositionID,
	createPool,
	computePoolID,
	createPosition,
	getNewPositionID,
	getFeeGrowthInside,
	getLiquidityForAmounts,
	checkPositionExistenceAndOwnership,
	computeCollectableFees,
	computeCollectableIncentives,
	transferToPool,
	transferPoolToPool,
	transferToProtocolFeeAccount,
	updatePosition

} from '../../../../src/app/modules/dex/utils/auxiliaryFunctions';

import { Address, PoolID, PositionID, TokenID } from '../../../../src/app/modules/dex/types';
import { TokenMethod, TokenModule } from 'lisk-framework';
import { createMethodContext, MethodContext } from 'lisk-framework/dist-node/state_machine/method_context';
import { PrefixedStateReadWriter } from 'lisk-framework/dist-node/state_machine/prefixed_state_read_writer';
import { EventQueue } from 'lisk-framework/dist-node/state_machine';
import { DexGlobalStore, PoolsStore, PositionsStore, PriceTicksStore, SettingsStore } from '../../../../src/app/modules/dex/stores';
import { DexModule } from '../../../../src/app/modules';
import { FeesIncentivesCollectedEvent, PoolCreatedEvent, PositionCreatedEvent, PositionUpdateFailedEvent } from '../../../../src/app/modules/dex/events';
import { PoolsStoreData } from '../../../../src/app/modules/dex/stores/poolsStore';
import { PriceTicksStoreData, tickToBytes } from '../../../../src/app/modules/dex/stores/priceTicksStore';
import { numberToQ96, q96ToBytes } from '../../../../src/app/modules/dex/utils/q96';
import { DexGlobalStoreData } from '../../../../src/app/modules/dex/stores/dexGlobalStore';
import { PositionsStoreData } from '../../../../src/app/modules/dex/stores/positionsStore';
import { InMemoryPrefixedStateDB } from './inMemoryPrefixedStateDB';
import { SettingsStoreData } from '../../../../src/app/modules/dex/stores/settingsStore';
import { tickToPrice } from '../../../../src/app/modules/dex/utils/math';

describe('dex:auxiliaryFunctions', () => {
	const poolId: PoolID = Buffer.from('0000000000000000000001000000000000c8','hex');
	const token0Id: TokenID = Buffer.from('0000000000000000', 'hex');
	const token1Id: TokenID = Buffer.from('0000010000000000', 'hex');
	const senderAddress: Address = Buffer.from('0000000000000000','hex');
	const positionId: PositionID = Buffer.from('00000001000000000101643130','hex');
	const feeTier: Number = Number('0x00000c8');
	let sqrtPrice: bigint = numberToQ96(BigInt(1));

	let methodContext: MethodContext;
	const tokenModule = new TokenModule();
	let inMemoryPrefixedStateDB = new InMemoryPrefixedStateDB();
	let tokenMethod: TokenMethod = new TokenMethod(tokenModule.stores, tokenModule.events, tokenModule.name);
	let stateStore: PrefixedStateReadWriter = new PrefixedStateReadWriter(inMemoryPrefixedStateDB);

	let poolsStore: PoolsStore;
	let priceTicksStore: PriceTicksStore;
	let dexGlobalStore: DexGlobalStore;
	let positionsStore: PositionsStore;
	let settingsStore: SettingsStore;

	const transferMock = jest.fn();
	const lockMock = jest.fn();
	const unlockMock = jest.fn();
	const getAvailableBalanceMock = jest.fn().mockReturnValue(BigInt(250));

	methodContext = createMethodContext({
		stateStore,
		eventQueue: new EventQueue(0),
	})

	const settings = {
		feeTiers: [
			100,
		]
	}

	const poolsStoreData: PoolsStoreData = {
		liquidity: BigInt(5),
		sqrtPrice: q96ToBytes(BigInt(1)),
		feeGrowthGlobal0: q96ToBytes(numberToQ96(BigInt(10))),
		feeGrowthGlobal1: q96ToBytes(numberToQ96(BigInt(6))),
		tickSpacing: 1
	}
	
	const priceTicksStoreDataTickLower: PriceTicksStoreData = {
		liquidityNet: BigInt(5),
		liquidityGross: BigInt(5),
		feeGrowthOutside0: q96ToBytes(numberToQ96(BigInt(8))),
		feeGrowthOutside1: q96ToBytes(numberToQ96(BigInt(5))),
	}
	
	const priceTicksStoreDataTickUpper: PriceTicksStoreData = {
		liquidityNet: BigInt(5),
		liquidityGross: BigInt(5),
		feeGrowthOutside0: q96ToBytes(numberToQ96(BigInt(4))),
		feeGrowthOutside1: q96ToBytes(numberToQ96(BigInt(3))),
	}

	const dexGlobalStoreData: DexGlobalStoreData = {
		positionCounter: BigInt(10),
		collectableLSKFees: BigInt(10),
	}
	const positionsStoreData: PositionsStoreData = {
		tickLower: -8,
		tickUpper: -5,
		liquidity: BigInt(10),
		feeGrowthInsideLast0: q96ToBytes(numberToQ96(BigInt(3))),
		feeGrowthInsideLast1: q96ToBytes(numberToQ96(BigInt(1))),
		ownerAddress: senderAddress
	}

	const settingStoreData: SettingsStoreData = {
		protocolFeeAddress: Buffer.from('0000000000000000','hex'),
		protocolFeePart: 10,
		validatorsLSKRewardsPart: 5,
		poolCreationSettings: {
			feeTier: 100,
			tickSpacing: 1
		}
	}

	describe('constructor', () => {
		beforeEach(async () => {

			tokenModule.stores.register(PoolsStore, new PoolsStore(DexModule.name));
			tokenModule.stores.register(PositionsStore, new PositionsStore(DexModule.name));
			tokenModule.stores.register(DexGlobalStore, new DexGlobalStore(DexModule.name));
			tokenModule.stores.register(PriceTicksStore, new PriceTicksStore(DexModule.name));
			tokenModule.stores.register(SettingsStore, new SettingsStore(DexModule.name));


			tokenModule.events.register(PositionUpdateFailedEvent, new PositionUpdateFailedEvent(DexModule.name));
			tokenModule.events.register(PositionCreatedEvent, new PositionCreatedEvent(DexModule.name));
			tokenModule.events.register(PoolCreatedEvent, new PoolCreatedEvent(DexModule.name));
			tokenModule.events.register(PoolCreatedEvent, new PoolCreatedEvent(DexModule.name));
			tokenModule.events.register(FeesIncentivesCollectedEvent, new FeesIncentivesCollectedEvent(DexModule.name));


			poolsStore = tokenModule.stores.get(PoolsStore);
			priceTicksStore = tokenModule.stores.get(PriceTicksStore);
			dexGlobalStore = tokenModule.stores.get(DexGlobalStore);
			positionsStore = tokenModule.stores.get(PositionsStore);
			settingsStore = tokenModule.stores.get(SettingsStore);

			await dexGlobalStore.set(methodContext, Buffer.from([]), dexGlobalStoreData)

			await settingsStore.set(methodContext, Buffer.from([]), settingStoreData)

			await poolsStore.setKey(methodContext, [senderAddress, getPoolIDFromPositionID(positionId)], poolsStoreData);
			await poolsStore.set(methodContext, getPoolIDFromPositionID(positionId), poolsStoreData);

			await priceTicksStore.setKey(methodContext, [getPoolIDFromPositionID(positionId), tickToBytes(positionsStoreData.tickLower)], priceTicksStoreDataTickLower)
			await priceTicksStore.setKey(methodContext, [getPoolIDFromPositionID(positionId), tickToBytes(positionsStoreData.tickUpper)], priceTicksStoreDataTickUpper)
			await priceTicksStore.setKey(methodContext, [getPoolIDFromPositionID(positionId), q96ToBytes(tickToPrice(positionsStoreData.tickLower))], priceTicksStoreDataTickLower)
			await priceTicksStore.setKey(methodContext, [getPoolIDFromPositionID(positionId), q96ToBytes(tickToPrice(positionsStoreData.tickUpper))], priceTicksStoreDataTickUpper)


			await positionsStore.set(methodContext, positionId, positionsStoreData);
			await positionsStore.setKey(methodContext, [senderAddress, positionId], positionsStoreData);


			tokenMethod.transfer = transferMock;
			tokenMethod.lock = lockMock;
			tokenMethod.unlock = unlockMock;
			tokenMethod.getAvailableBalance = getAvailableBalanceMock.mockReturnValue(BigInt(250));


		})
		it('should get Token0Id from poolID', async () => {
			expect(getToken0Id(poolId)).toEqual(token0Id);

		});
		it('should get Token1Id from poolID', async () => {
			expect(getToken1Id(poolId)).toEqual(token1Id);
		});
		it('should return the feeTier from the poolID', async () => {
			expect(getFeeTier(poolId)).toEqual(feeTier);
		});

		it('should transfer and lock using the tokenMethod', async () => {

			await transferToPool(tokenMethod, methodContext, senderAddress, poolId, token1Id, BigInt(1));
			expect(tokenMethod.transfer).toBeCalled();
			expect(tokenMethod.lock).toBeCalled();
		});


		it('should transfer, lock and unlock for transferPoolToPool', async () => {
			await transferPoolToPool(tokenMethod, methodContext, senderAddress, senderAddress, token1Id, BigInt(1));
			expect(tokenMethod.transfer).toBeCalled();
			expect(tokenMethod.lock).toBeCalled();
			expect(tokenMethod.unlock).toBeCalled();

		});

		it('should transfer for transferToProtocolFeeAccount', async () => {
			await transferToProtocolFeeAccount(tokenMethod, methodContext, settingsStore, senderAddress, token1Id, BigInt(1));
			expect(tokenMethod.transfer).toBeCalled();
		});

		it('should return the poolId from the positionId', async () => {
			expect(getPoolIDFromPositionID(positionId).toString('hex')).toBe('00000001000000000101643130');
		});

		it('should return 0 as POOL_CREATION_SUCCESS', async () => {
			expect(await createPool(settings, methodContext, poolsStore, token0Id, token1Id, 0, sqrtPrice)).toBe(0);
		});

		it('should return concatenated (tokenID0, tokenID1, feeTier) after computing poolID', async () => {
			expect(await computePoolID(token0Id, token1Id, Number(0x0064).valueOf()).toString('hex')).toBe('0000000000000000000001000000000064000000');
		});

		it('should return 0 for POSITION_CREATION_SUCCESS and positionID in result', async () => {
			await createPosition(methodContext, tokenModule.stores, senderAddress, getPoolIDFromPositionID(positionId), positionsStoreData.tickLower, positionsStoreData.tickUpper).then(res => {
				expect(res[0]).toBe(0);
			});
		});

		it('should return concatenated poolID with dexGlobalStoreData.positionCounter in result', async () => {
			expect(await getNewPositionID(dexGlobalStoreData, getPoolIDFromPositionID(positionId)).toString('hex')).toBe("000000010000000001016431303130");
		});

		it('should return [316912650057057350374175801344,158456325028528675187087900672] as feeGrowthInside0, feeGrowthInside1 in result', async () => {
			await getFeeGrowthInside(tokenModule.stores, methodContext, positionId).then(res => {
				expect(res[0]).toBe(BigInt(316912650057057350374175801344));
				expect(res[1]).toBe(BigInt(158456325028528675187087900672));
			});
		});


		it('should return BigInt(3) in result', async () => {
			await expect( getLiquidityForAmounts(numberToQ96(BigInt(2)),
				numberToQ96(BigInt(1)),
				numberToQ96(BigInt(5)),
				BigInt(1),
				BigInt(3)
			)).toBe(BigInt(3));
		});

		it('should not throw any error in result', async () => {
			await checkPositionExistenceAndOwnership(tokenModule.stores, tokenModule.events, methodContext, senderAddress, positionId);
		});

		it('should return [0n, 0n, 316912650057057350374175801344, 158456325028528675187087900672] as collectableFees0, collectableFees1, feeGrowthInside0, feeGrowthInside1 in result', async () => {
			await computeCollectableFees(tokenModule.stores, methodContext, positionId).then(res => {
				expect(res[0]).toBe(BigInt(0));
				expect(res[1]).toBe(BigInt(0));
				expect(res[2]).toBe(BigInt(316912650057057350374175801344));
				expect(res[3]).toBe(BigInt(158456325028528675187087900672));
			});
		});

		it('should return [1,25] in result', async () => {
			await computeCollectableIncentives(dexGlobalStore, tokenMethod, methodContext,positionId, BigInt(1), BigInt(2)).then(res => {
				expect(res[0]).toBe(BigInt(1));
				expect(res[1]).toBe(BigInt(25));
			})
		});

		it('should return [0,0] as newTestpositionId!=positionId', async () => {
			const newTestpositionId: PositionID = Buffer.from('0x00000000000100000000000000000000c8','hex');
			await computeCollectableIncentives(dexGlobalStore, tokenMethod, methodContext, newTestpositionId, BigInt(1), BigInt(2)).then(res => {
				expect(res[0]).toBe(BigInt(0));
				expect(res[1]).toBe(BigInt(0));
			})
		});

		it('should return [79228162514264337593543950335,0] in result', async () => {
			await updatePosition(methodContext, tokenModule.events, tokenModule.stores, tokenMethod, positionId, BigInt(1)).then(res => {
				expect(res[0].toString()).toBe('79228162514264337593543950335');
				expect(res[1].toString()).toBe('1');

			});
		});

		it('should fail position update as due to insufficeint liquidity', async () => {
			await expect(updatePosition(methodContext, tokenModule.events, tokenModule.stores, tokenMethod, positionId, BigInt(-100))).rejects.toThrowError();
		});


		it('should return [0,0] liquidityDelta is 0', async () => {
			expect(await updatePosition(methodContext, tokenModule.events, tokenModule.stores, tokenMethod, positionId, BigInt(0)).then(res => {
				expect(res[0].toString()).toBe('0');
				expect(res[1].toString()).toBe('0');

			}));
		});

	});

});


