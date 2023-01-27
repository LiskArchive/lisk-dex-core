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

import { DexModule } from '../../../../src/app/modules';
import {
	DexGlobalStore,
	PoolsStore,
	PositionsStore,
	PriceTicksStore,
	SettingsStore,
} from '../../../../src/app/modules/dex/stores';
import { Address, PoolID, PositionID } from '../../../../src/app/modules/dex/types';

import { numberToQ96, q96ToBytes } from '../../../../src/app/modules/dex/utils/q96';
import { InMemoryPrefixedStateDB } from './inMemoryPrefixedState';

import {
	createMethodContext,
	EventQueue,
	MethodContext,
} from 'lisk-framework/dist-node/state_machine';
import { TokenMethod } from 'lisk-sdk';
import { tickToPrice } from '../../../../src/app/modules/dex/utils/math';
import {
	PriceTicksStoreData,
	tickToBytes,
} from '../../../../src/app/modules/dex/stores/priceTicksStore';
import { DexGlobalStoreData } from '../../../../src/app/modules/dex/stores/dexGlobalStore';
import { PositionsStoreData } from '../../../../src/app/modules/dex/stores/positionsStore';
import { SettingsStoreData } from '../../../../src/app/modules/dex/stores/settingsStore';
import { PoolsStoreData } from '../../../../src/app/modules/dex/stores/poolsStore';
import { getPoolIDFromPositionID } from '../../../../src/app/modules/dex/utils/auxiliaryFunctions';
import { DexEndpoint } from '../../../../src/app/modules/dex/endpoint';
import { createTransientModuleEndpointContext } from '../../../context/createContext';
import { PrefixedStateReadWriter } from '../../../stateMachine/prefixedStateReadWriter';

describe('dex: offChainEndpointFunctions', () => {
	const poolId: PoolID = Buffer.from('0000000000000000000001000000000000c8', 'hex');
	const senderAddress: Address = Buffer.from('0000000000000000', 'hex');
	const positionId: PositionID = Buffer.from('00000001000000000101643130', 'hex');
	const dexModule = new DexModule();
	const INVALID_ADDRESS = '1234';
	const tokenMethod = new TokenMethod(dexModule.stores, dexModule.events, dexModule.name);
	//const stateStore: PrefixedStateReadWriter = new PrefixedStateReadWriter(inMemoryPrefixedStateDB);

	let stateStore: PrefixedStateReadWriter;
	stateStore = new PrefixedStateReadWriter(new InMemoryPrefixedStateDB());

	const moduleEndpointContext = createTransientModuleEndpointContext({
		stateStore,
		params: { address: INVALID_ADDRESS },
	});

	const methodContext: MethodContext = createMethodContext({
		contextStore: new Map(),
		stateStore,
		eventQueue: new EventQueue(0),
	});

	let poolsStore: PoolsStore;
	let priceTicksStore: PriceTicksStore;
	let dexGlobalStore: DexGlobalStore;
	let positionsStore: PositionsStore;
	let settingsStore: SettingsStore;
	let endpoint: DexEndpoint;

	const transferMock = jest.fn();
	const lockMock = jest.fn();
	const unlockMock = jest.fn();
	const getAvailableBalanceMock = jest.fn().mockReturnValue(BigInt(250));
	const lockedAmountMock = jest.fn().mockReturnValue(BigInt(5));

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
		collectableLSKFees: BigInt(10),
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
	};

	const settingStoreData: SettingsStoreData = {
		protocolFeeAddress: Buffer.from('0000000000000000', 'hex'),
		protocolFeePart: 10,
		validatorsLSKRewardsPart: 5,
		poolCreationSettings: {
			feeTier: 100,
			tickSpacing: 1,
		},
	};

	describe('constructor', () => {
		beforeEach(async () => {
			poolsStore = dexModule.stores.get(PoolsStore);
			priceTicksStore = dexModule.stores.get(PriceTicksStore);
			dexGlobalStore = dexModule.stores.get(DexGlobalStore);
			positionsStore = dexModule.stores.get(PositionsStore);
			settingsStore = dexModule.stores.get(SettingsStore);
			endpoint = new DexEndpoint(dexModule.stores, dexModule.offchainStores);

			await dexGlobalStore.set(methodContext, Buffer.from([]), dexGlobalStoreData);

			await settingsStore.set(methodContext, Buffer.from([]), settingStoreData);

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
			tokenMethod.getLockedAmount = lockedAmountMock.mockReturnValue(BigInt(5));
		});

		it('getAllPoolIDs', async () => {
			await endpoint.getAllPoolIDs(moduleEndpointContext).then(res => {
				expect(res[0]).toStrictEqual(
					Buffer.from('000000000000000000000001000000000101643130', 'hex'),
				);
			});
		});

		it('getAllTokenIDs', async () => {
			await endpoint.getAllTokenIDs(moduleEndpointContext).then(res => {
				expect(res.size).toBeGreaterThan(0);
			});
		});

		it('getAllPositionIDsInPool', () => {
			const moduleEndpointContext = createTransientModuleEndpointContext({
				stateStore,
				params: { poolId: getPoolIDFromPositionID(positionId), positionIdsList: [positionId] },
			});
			const positionIDs = endpoint.getAllPositionIDsInPool(moduleEndpointContext);
			expect(positionIDs.indexOf(positionId)).not.toBe(-1);
		});

		it('getPool', async () => {
			const tempModuleEndpointContext = createTransientModuleEndpointContext({
				stateStore,
				params: { poolId: getPoolIDFromPositionID(positionId) },
			});
			await endpoint.getPool(tempModuleEndpointContext).then(res => {
				expect(res).not.toBeNull();
				expect(res.liquidity).toBe(BigInt(5));
			});
		});

		it('getCurrentSqrtPrice', async () => {
			const moduleEndpointContext = createTransientModuleEndpointContext({
				stateStore,
				params: { poolId: getPoolIDFromPositionID(positionId), priceDirection: false },
			});

			expect((await endpoint.getCurrentSqrtPrice(moduleEndpointContext)).toString()).toBe(
				'79208358939348018173455069823',
			);
		});

		it('getDexGlobalData', async () => {
			await endpoint.getDexGlobalData(moduleEndpointContext).then(res => {
				expect(res).not.toBeNull();
				expect(res.positionCounter).toBe(BigInt(15));
				expect(res.collectableLSKFees).toBe(BigInt(10));
			});
		});

		it('getPosition', async () => {
			const positionIdsList = [positionId];
			const newPositionId: PositionID = Buffer.from('00000001000000000101643130', 'hex');
			await positionsStore.set(methodContext, newPositionId, positionsStoreData);
			await positionsStore.setKey(methodContext, [newPositionId], positionsStoreData);
			const moduleEndpointContext = createTransientModuleEndpointContext({
				stateStore,
				params: { positionId: newPositionId, positionIdsList: positionIdsList },
			});
			await endpoint.getPosition(moduleEndpointContext).then(res => {
				expect(res).not.toBeNull();
			});
		});

		it('getTickWithTickId', async () => {
			const tickWithTickID = await endpoint.getTickWithTickId(moduleEndpointContext, [
				getPoolIDFromPositionID(positionId),
				tickToBytes(positionsStoreData.tickLower),
			]);
			expect(tickWithTickID).not.toBeNull();
			expect(tickWithTickID.liquidityNet).toBe(BigInt(5));
		});

		it('getTickWithPoolIdAndTickValue', async () => {
			const tickWithPoolIdAndTickValue = await endpoint.getTickWithPoolIdAndTickValue(
				moduleEndpointContext,
				getPoolIDFromPositionID(positionId),
				5,
			);
			expect(tickWithPoolIdAndTickValue).not.toBeNull();
			expect(tickWithPoolIdAndTickValue.liquidityNet).toBe(BigInt(5));
		});
	});
});
