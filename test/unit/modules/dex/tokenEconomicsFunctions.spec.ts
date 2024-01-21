/* eslint-disable import/no-cycle */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
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
import { PrefixedStateReadWriter } from 'lisk-framework/dist-node/state_machine/prefixed_state_read_writer';
import { createMethodContext, EventQueue } from 'lisk-framework/dist-node/state_machine';

import {
	getPoolIDFromPositionID,
	getPool,
} from '../../../../src/app/modules/dex/utils/auxiliaryFunctions';

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
import {
	computeNewIncentivesPerLiquidity,
	updatePoolIncentives,
} from '../../../../src/app/modules/dex/utils/tokenEconomicsFunctions';

const { InMemoryPrefixedStateDB } = testing;

describe('dex:tokenEconomicsFunctions', () => {
	const poolId: PoolID = Buffer.from('0000000000000000000001000000000000c8', 'hex');
	const poolIdLSK = Buffer.from('0000000100000000', 'hex');
	const senderAddress: Address = Buffer.from('0000000000000000', 'hex');
	const positionId: PositionID = Buffer.from('00000001000000000101643130', 'hex');
	const dexModule = new DexModule();

	const inMemoryPrefixedStateDB = new InMemoryPrefixedStateDB();
	const tokenMethod = new TokenMethod(dexModule.stores, dexModule.events, dexModule.name);
	const stateStore: PrefixedStateReadWriter = new PrefixedStateReadWriter(inMemoryPrefixedStateDB);

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
		incentivesPerLiquidityAccumulator: q96ToBytes(numberToQ96(BigInt(1))),
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

			await poolsStore.setKey(methodContext, [poolId], poolsStoreData);
			await poolsStore.setKey(methodContext, [poolIdLSK], poolsStoreData);
			await poolsStore.set(methodContext, poolIdLSK, poolsStoreData);
			await poolsStore.set(methodContext, getPoolIDFromPositionID(positionId), poolsStoreData);

			await priceTicksStore.setKey(
				methodContext,
				[getPoolIDFromPositionID(positionId), tickToBytes(positionsStoreData.tickLower)],
				priceTicksStoreDataTickLower,
			);

			await priceTicksStore.setKey(
				methodContext,
				[
					Buffer.from(
						getPoolIDFromPositionID(positionId).toLocaleString() + tickToBytes(5).toLocaleString(),
						'hex',
					),
				],
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

		it('updatePoolIncentives', async () => {
			const pool = await getPool(methodContext, dexModule.stores, poolId);
			await poolsStore.set(methodContext, poolId, poolsStoreData);
			const currentHeight = pool.heightIncentivesUpdate + 10;
			const newIncentivesPerLiquidity = await computeNewIncentivesPerLiquidity(
				methodContext,
				dexModule.stores,
				poolId,
				currentHeight,
			);
			await updatePoolIncentives(methodContext, dexModule.stores, poolId, currentHeight);
			expect(newIncentivesPerLiquidity).toEqual(BigInt(79228162514264337593543950336));
		});
	});
});
