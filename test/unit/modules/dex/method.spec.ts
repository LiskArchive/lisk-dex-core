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

import { MethodContext, TokenMethod } from 'lisk-framework';
import { testing } from 'lisk-sdk';
import { createMethodContext, EventQueue } from 'lisk-framework/dist-node/state_machine';

import { PrefixedStateReadWriter } from '../../../stateMachine/prefixedStateReadWriter';
import { getPoolIDFromPositionID } from '../../../../src/app/modules/dex/utils/auxiliaryFunctions';
import { Address, PoolID, PositionID } from '../../../../src/app/modules/dex/types';
import { tickToPrice } from '../../../../src/app/modules/dex/utils/math';
import { numberToQ96, q96ToBytes } from '../../../../src/app/modules/dex/utils/q96';
import { DexModule } from '../../../../src/app/modules';
import {
	DexGlobalStore,
	PoolsStore,
	PositionsStore,
	PriceTicksStore,
} from '../../../../src/app/modules/dex/stores';
import { PoolsStoreData } from '../../../../src/app/modules/dex/stores/poolsStore';
import {
	PriceTicksStoreData,
	tickToBytes,
} from '../../../../src/app/modules/dex/stores/priceTicksStore';
import { DexGlobalStoreData } from '../../../../src/app/modules/dex/stores/dexGlobalStore';
import { PositionsStoreData } from '../../../../src/app/modules/dex/stores/positionsStore';

const { InMemoryPrefixedStateDB } = testing;

describe('dex:auxiliaryFunctions', () => {
	const poolId: PoolID = Buffer.from('0000000000000000000001000000000000c8', 'hex');
	const senderAddress: Address = Buffer.from('0000000000000000', 'hex');
	const positionId: PositionID = Buffer.from('00000001000000000101643130', 'hex');
	const dexModule = new DexModule();
	const tokenMethod = new TokenMethod(dexModule.stores, dexModule.events, dexModule.name);

	const stateStore = new PrefixedStateReadWriter(new InMemoryPrefixedStateDB());

	const methodContext: MethodContext = createMethodContext({
		contextStore: new Map(),
		stateStore,
		eventQueue: new EventQueue(0),
	});

	let poolsStore: PoolsStore;
	let priceTicksStore: PriceTicksStore;
	let dexGlobalStore: DexGlobalStore;
	let positionsStore: PositionsStore;

	const transferMock = jest.fn();
	const lockMock = jest.fn();
	const unlockMock = jest.fn();
	const getAvailableBalanceMock = jest.fn().mockReturnValue(BigInt(250));
	const getLockedAmountMock = jest.fn().mockReturnValue(BigInt(5));

	const poolsStoreData: PoolsStoreData = {
		liquidity: BigInt(5),
		sqrtPrice: q96ToBytes(BigInt(tickToPrice(5))),
		incentivesPerLiquidityAccumulator: q96ToBytes(numberToQ96(BigInt(0))),
		heightIncentivesUpdate: 5,
		feeGrowthGlobal0: q96ToBytes(numberToQ96(BigInt(0))),
		feeGrowthGlobal1: q96ToBytes(numberToQ96(BigInt(0))),
		tickSpacing: 1,
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

	const dexGlobalStoreData: DexGlobalStoreData = {
		positionCounter: BigInt(15),
		poolCreationSettings: [{ feeTier: 100, tickSpacing: 1 }],
		incentivizedPools: [{ poolId, multiplier: 10 }],
		totalIncentivesMultiplier: 1,
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

	describe('constructor', () => {
		beforeEach(async () => {
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

			await poolsStore.setKey(methodContext, [senderAddress, poolId], poolsStoreData);
			await poolsStore.set(methodContext, poolId, poolsStoreData);

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
				[
					getPoolIDFromPositionID(positionId),
					q96ToBytes(tickToPrice(positionsStoreData.tickLower)),
				],
				priceTicksStoreDataTickLower,
			);
			await priceTicksStore.setKey(
				methodContext,
				[
					getPoolIDFromPositionID(positionId),
					q96ToBytes(tickToPrice(positionsStoreData.tickUpper)),
				],
				priceTicksStoreDataTickUpper,
			);

			await positionsStore.set(methodContext, positionId, positionsStoreData);
			await positionsStore.setKey(methodContext, [senderAddress, positionId], positionsStoreData);

			tokenMethod.transfer = transferMock;
			tokenMethod.lock = lockMock;
			tokenMethod.unlock = unlockMock;
			tokenMethod.getAvailableBalance = getAvailableBalanceMock.mockReturnValue(BigInt(250));
			tokenMethod.getLockedAmount = getLockedAmountMock.mockReturnValue(BigInt(5));
		});

		it('poolExists', async () => {
			const poolExistResult = await dexModule.method.poolExists(methodContext, poolsStore, poolId);
			const exists = await poolsStore.has(methodContext, poolId);
			expect(poolExistResult).toEqual(exists);
		});

		it.skip('addPoolCreationSettings', async () => {
			const tickSpacing = 10;
			const feeTier = 100;
			await dexModule.method.addPoolCreationSettings(methodContext, feeTier, tickSpacing);

			expect(dexGlobalStoreData.poolCreationSettings[0].feeTier).toEqual(feeTier);
			expect(dexGlobalStoreData.poolCreationSettings[0].feeTier).toEqual(tickSpacing);
		});

		it.skip('updateIncentivizedPools', async () => {
			const tickSpacing = 10;
			const feeTier = 100;
			await dexModule.method.addPoolCreationSettings(methodContext, feeTier, tickSpacing);
			await dexModule.method.updateIncentivizedPools(methodContext, poolId, 100, 1000000);

			expect(dexGlobalStoreData.poolCreationSettings[0].feeTier).toEqual(feeTier);
			expect(dexGlobalStoreData.poolCreationSettings[0].feeTier).toEqual(tickSpacing);
		});

		it('getCurrentSqrtPrice', async () => {
			const currentSqrtPrice = await dexModule.method.getCurrentSqrtPrice(
				methodContext,
				poolId,
				true,
			);
			expect(currentSqrtPrice).toEqual(BigInt('79247971040445709311708648151'));
		});
	});
});
