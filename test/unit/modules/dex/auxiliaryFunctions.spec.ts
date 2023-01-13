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

import { MethodContext, TokenMethod } from 'lisk-framework';
import { PrefixedStateReadWriter } from 'lisk-framework/dist-node/state_machine/prefixed_state_read_writer';
import { createMethodContext, EventQueue } from 'lisk-framework/dist-node/state_machine';

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
	updatePosition,
	getToken1Amount,
	getToken0Amount,
	getPool,
	getAllTicks,
	addPoolCreationSettings,
	getCredibleDirectPrice,
	getProtocolSettings,
	getPositionIndex,
	computeExceptionalRoute,
	computeRegularRoute,
	getAllPoolIDs,
	getTickWithTickId,
	getDexGlobalData,
	getTickWithPoolIdAndTickValue,
	updateIncentivizedPools
} from '../../../../src/app/modules/dex/utils/auxiliaryFunctions';

import { Address, PoolID, PositionID, TokenID } from '../../../../src/app/modules/dex/types';
import { priceToTick, tickToPrice } from '../../../../src/app/modules/dex/utils/math';
import { numberToQ96, q96ToBytes } from '../../../../src/app/modules/dex/utils/q96';
import { DexModule } from '../../../../src/app/modules';
import { InMemoryPrefixedStateDB } from './inMemoryPrefixedState';
import {
	DexGlobalStore,
	PoolsStore,
	PositionsStore,
	PriceTicksStore,
	SettingsStore,
} from '../../../../src/app/modules/dex/stores';
import { PoolsStoreData } from '../../../../src/app/modules/dex/stores/poolsStore';
import {
	PriceTicksStoreData,
	tickToBytes,
} from '../../../../src/app/modules/dex/stores/priceTicksStore';
import { DexGlobalStoreData } from '../../../../src/app/modules/dex/stores/dexGlobalStore';
import { PositionsStoreData } from '../../../../src/app/modules/dex/stores/positionsStore';
import { SettingsStoreData } from '../../../../src/app/modules/dex/stores/settingsStore';

describe('dex:auxiliaryFunctions', () => {
	const poolId: PoolID = Buffer.from('0000000000000000000001000000000000c8', 'hex');
	const token0Id: TokenID = Buffer.from('0000000000000000', 'hex');
	const token1Id: TokenID = Buffer.from('0000010000000000', 'hex');
	const poolIdLSK = Buffer.from('0000000100000000', 'hex');
	const senderAddress: Address = Buffer.from('0000000000000000', 'hex');
	const positionId: PositionID = Buffer.from('00000001000000000101643130', 'hex');
	const feeTier = Number('0x00000c8');
	const sqrtPrice: bigint = numberToQ96(BigInt(1));
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
	let settingsStore: SettingsStore;

	const transferMock = jest.fn();
	const lockMock = jest.fn();
	const unlockMock = jest.fn();
	const getAvailableBalanceMock = jest.fn().mockReturnValue(BigInt(250));
	const getLockedAmountMock = jest.fn().mockReturnValue(BigInt(5));

	const settings = {
		feeTiers: [100],
	};

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

			await dexGlobalStore.set(methodContext, Buffer.from([]), dexGlobalStoreData);

			await settingsStore.set(methodContext, Buffer.from([]), settingStoreData);

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
		it('should get Token0Id from poolID', () => {
			expect(getToken0Id(poolId)).toEqual(token0Id);
		});
		it('should get Token1Id from poolID', () => {
			expect(getToken1Id(poolId)).toEqual(token1Id);
		});
		it('should return the feeTier from the poolID', () => {
			expect(getFeeTier(poolId)).toEqual(feeTier);
		});

		it('should transfer and lock using the tokenMethod', async () => {
			await transferToPool(tokenMethod, methodContext, senderAddress, poolId, token1Id, BigInt(1));
			expect(tokenMethod.transfer).toHaveBeenCalled();
			expect(tokenMethod.lock).toHaveBeenCalled();
		});

		it('should transfer, lock and unlock for transferPoolToPool', async () => {
			await transferPoolToPool(
				tokenMethod,
				methodContext,
				senderAddress,
				senderAddress,
				token1Id,
				BigInt(1),
			);
			expect(tokenMethod.transfer).toHaveBeenCalled();
			expect(tokenMethod.lock).toHaveBeenCalled();
			expect(tokenMethod.unlock).toHaveBeenCalled();
		});

		it('should transfer for transferToProtocolFeeAccount', async () => {
			await transferToProtocolFeeAccount(
				tokenMethod,
				methodContext,
				settingsStore,
				senderAddress,
				token1Id,
				BigInt(1),
			);
			expect(tokenMethod.transfer).toHaveBeenCalled();
		});

		it('should return the poolId from the positionId', () => {
			expect(getPoolIDFromPositionID(positionId).toString('hex')).toBe(
				'00000001000000000101643130',
			);
		});

		it('should return 0 as POOL_CREATION_SUCCESS', async () => {
			expect(
				await createPool(settings, methodContext, poolsStore, token0Id, token1Id, 0, sqrtPrice),
			).toBe(0);
		});

		it('should return concatenated (tokenID0, tokenID1, feeTier) after computing poolID', () => {
			expect(computePoolID(token0Id, token1Id, Number(0x0064).valueOf()).toString('hex')).toBe(
				'0000000000000000000001000000000064000000',
			);
		});

		it('should return 0 for POSITION_CREATION_SUCCESS and positionID in result', async () => {
			await createPosition(
				methodContext,
				dexModule.stores,
				senderAddress,
				getPoolIDFromPositionID(positionId),
				positionsStoreData.tickLower,
				positionsStoreData.tickUpper,
			).then(res => {
				expect(res[0]).toBe(0);
			});
		});

		it('should return concatenated poolID with dexGlobalStoreData.positionCounter in result', () => {
			expect(
				getNewPositionID(dexGlobalStoreData, getPoolIDFromPositionID(positionId)).toString('hex'),
			).toBe('000000010000000001016431303135');
		});

		it('should return [316912650057057350374175801344,158456325028528675187087900672] as feeGrowthInside0, feeGrowthInside1 in result', async () => {
			await getFeeGrowthInside(dexModule.stores, methodContext, positionId).then(res => {
				expect(res[0]).toBe(BigInt(0));
				expect(res[1]).toBe(BigInt(0));
			});
		});

		it('should return BigInt(3) in result', () => {
			expect(
				getLiquidityForAmounts(
					numberToQ96(BigInt(2)),
					numberToQ96(BigInt(1)),
					numberToQ96(BigInt(5)),
					BigInt(1),
					BigInt(3),
				),
			).toBe(BigInt(3));
		});

		it('should not throw any error in result', async () => {
			expect(
				await checkPositionExistenceAndOwnership(
					dexModule.stores,
					dexModule.events,
					methodContext,
					senderAddress,
					positionId,
				),
			).toBeUndefined();
		});

		it('should return [0n, 0n, 0n, 0n] as collectableFees0, collectableFees1, feeGrowthInside0, feeGrowthInside1 in result', async () => {
			await computeCollectableFees(dexModule.stores, methodContext, positionId).then(res => {
				expect(res[0]).toBe(BigInt(0));
				expect(res[1]).toBe(BigInt(0));
				expect(res[2]).toBe(BigInt(0));
				expect(res[3]).toBe(BigInt(0));
			});
		});

		it('should return [1n,25n] in result', async () => {
			await computeCollectableIncentives(
				dexGlobalStore,
				tokenMethod,
				methodContext,
				positionId,
				BigInt(1),
				BigInt(2),
			).then(res => {
				expect(res[0]).toBe(BigInt(1));
				expect(res[1]).toBe(BigInt(25));
			});
		});

		it('should return [0,0] as newTestpositionId!=positionId', async () => {
			const newTestpositionId: PositionID = Buffer.from(
				'0x00000000000100000000000000000000c8',
				'hex',
			);
			await computeCollectableIncentives(
				dexGlobalStore,
				tokenMethod,
				methodContext,
				newTestpositionId,
				BigInt(1),
				BigInt(2),
			).then(res => {
				expect(res[0]).toBe(BigInt(0));
				expect(res[1]).toBe(BigInt(0));
			});
		});

		it('should return [1,1] in result as liquidityDelta is 1', async () => {
			await updatePosition(
				methodContext,
				dexModule.events,
				dexModule.stores,
				tokenMethod,
				positionId,
				BigInt(200),
			).then(res => {
				expect(res[0]).toBe(BigInt(1));
				expect(res[1]).toBe(BigInt(1));
			});
		});

		it('should fail position update as due to insufficeint liquidity', async () => {
			await expect(
				updatePosition(
					methodContext,
					dexModule.events,
					dexModule.stores,
					tokenMethod,
					positionId,
					BigInt(-10000),
				),
			).rejects.toThrow();
		});

		it('should return [0,0] liquidityDelta is 0', async () => {
			expect(
				await updatePosition(
					methodContext,
					dexModule.events,
					dexModule.stores,
					tokenMethod,
					positionId,
					BigInt(0),
				).then(res => {
					expect(res[0]).toBe(BigInt(0));
					expect(res[1]).toBe(BigInt(0));
				}),
			).toBeUndefined();
		});
		it('priceToTick', () => {
			expect(priceToTick(tickToPrice(-735247))).toEqual(-735247);
		});

		it('getToken0Amount', async () => {
			await getToken0Amount(tokenMethod, methodContext, poolId).then(res => {
				expect(res).toBe(BigInt(5));
			});
		});

		it('getToken1Amount', async () => {
			await getToken1Amount(tokenMethod, methodContext, poolId).then(res => {
				expect(res).toBe(BigInt(5));
			});
		});

		it('getPool', async () => {
			await getPool(methodContext, dexModule.stores, getPoolIDFromPositionID(positionId)).then(
				res => {
					expect(res).not.toBeNull();
					expect(res.liquidity).toBe(BigInt(5));
				},
			);
		});

		it('getAllTicks', async () => {
			await getAllTicks(methodContext, dexModule.stores).then(res => {
				expect(res).not.toBeNull();
			});
		});

		it('getCredibleDirectPrice', async () => {
			const result = Buffer.alloc(4);
			const newTokenIDsArray = [
				token0Id,
				token1Id,
				q96ToBytes(
					BigInt(result.writeUInt32BE(dexGlobalStoreData.poolCreationSettings[0].feeTier, 0)),
				),
			];
			await poolsStore.setKey(methodContext, newTokenIDsArray, poolsStoreData);
			await poolsStore.set(methodContext, Buffer.from(newTokenIDsArray), poolsStoreData);
			await getCredibleDirectPrice(
				tokenMethod,
				methodContext,
				dexModule.stores,
				token0Id,
				token1Id,
			).then(res => {
				expect(res.toString()).toBe('79267784519130042428790663800');
			});
		});

		it('addPoolCreationSettings', async () => {
			await expect(
				addPoolCreationSettings(methodContext, dexModule.stores, 101, 300),
			).resolves.toBeUndefined();
		});

		it('getProtocolSettings', async () => {
			await getProtocolSettings(methodContext, dexModule.stores).then(res => {
				expect(res).not.toBeNull();
				expect(res.positionCounter).toBe(BigInt(16));
			});
		});

		it('getPositionIndex', () => {
			expect(getPositionIndex(positionId)).toBe(1);
		});

		it('computeRegularRoute ', async () => {
			const adjacentToken = Buffer.from('0000000000000000000001000000000000000000', 'hex');
			const res = await computeRegularRoute(
				methodContext,
				dexModule.stores,
				token0Id,
				adjacentToken,
			);
			let searchFlag = false;
			for (const item of res) {
				if (adjacentToken.equals(item)) {
					searchFlag = true;
				}
			}
			expect(searchFlag).toBeTruthy();
		});

		it('computeExceptionalRoute should return 0', async () => {
			expect(
				await computeExceptionalRoute(methodContext, dexModule.stores, token0Id, token1Id),
			).toHaveLength(0);
		});

		it('computeExceptionalRoute should return route with tokenID', async () => {
			expect(
				(await computeExceptionalRoute(methodContext, dexModule.stores, token0Id, token0Id))[0],
			).toStrictEqual(Buffer.from('0000000000000000', 'hex'));
		});

		it('getAllPoolIDs', async () => {
			await getAllPoolIDs(methodContext, dexModule.stores.get(PoolsStore)).then(res => {
				expect(res[0]).toStrictEqual(Buffer.from('00000001000000000101643130', 'hex'));
			});
		});

		it('getTickWithTickId', async () => {
			const tickWithTickID = await getTickWithTickId(methodContext, dexModule.stores, [
				getPoolIDFromPositionID(positionId),
				tickToBytes(positionsStoreData.tickLower),
			]);
			expect(tickWithTickID).not.toBeNull();
			expect(tickWithTickID.liquidityNet).toBe(BigInt(5));
		});

		it('getDexGlobalData', async () => {
			await getDexGlobalData(methodContext, dexModule.stores).then(res => {
				expect(res).not.toBeNull();
				expect(res.positionCounter).toBe(BigInt(16));
				expect(res.collectableLSKFees).toBe(BigInt(10));
			});
		});

		it('getTickWithPoolIdAndTickValue', async () => {
			const tickWithPoolIdAndTickValue = await getTickWithPoolIdAndTickValue(
				methodContext,
				dexModule.stores,
				getPoolIDFromPositionID(positionId),
				5,
			);
			expect(tickWithPoolIdAndTickValue).not.toBeNull();
			expect(tickWithPoolIdAndTickValue.liquidityNet).toBe(BigInt(5));
		});

		it('updateIncentivizedPools', async () => {
			const incentivizedPoolsLength = dexGlobalStoreData.incentivizedPools.length;
			const totalIncentivesMultiplier = dexGlobalStoreData.totalIncentivesMultiplier;
			const multiplier = 20;
			const currentHeight = 100;
			await updateIncentivizedPools(
				methodContext,
				dexModule.stores,
				poolId,
				multiplier,
				BigInt(currentHeight)
			);
			expect(dexGlobalStoreData.totalIncentivesMultiplier).toEqual(totalIncentivesMultiplier + 10);
			expect(dexGlobalStoreData.incentivizedPools.length).toEqual(incentivizedPoolsLength);
		})
	});
});
