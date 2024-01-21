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

import {
	createMethodContext,
	EventQueue,
	MethodContext,
} from 'lisk-framework/dist-node/state_machine';
import { TokenMethod, testing } from 'lisk-sdk';
import { DexModule } from '../../../../src/app/modules';
import {
	DexGlobalStore,
	PoolsStore,
	PositionsStore,
	PriceTicksStore,
} from '../../../../src/app/modules/dex/stores';
import { Address, PoolID, PositionID, TokenID } from '../../../../src/app/modules/dex/types';

import { numberToQ96, q96ToBytes, bytesToQ96 } from '../../../../src/app/modules/dex/utils/q96';
import { priceToTick, tickToPrice } from '../../../../src/app/modules/dex/utils/math';

import {
	PriceTicksStoreData,
	tickToBytes,
} from '../../../../src/app/modules/dex/stores/priceTicksStore';
import { DexGlobalStoreData } from '../../../../src/app/modules/dex/stores/dexGlobalStore';
import { PositionsStoreData } from '../../../../src/app/modules/dex/stores/positionsStore';
import { PoolsStoreData } from '../../../../src/app/modules/dex/stores/poolsStore';
import { getPoolIDFromPositionID } from '../../../../src/app/modules/dex/utils/auxiliaryFunctions';
import { DexEndpoint } from '../../../../src/app/modules/dex/endpoint';
import { createTransientModuleEndpointContext } from '../../../context/createContext';
import { PrefixedStateReadWriter } from '../../../stateMachine/prefixedStateReadWriter';
import { NUM_BYTES_POOL_ID } from '../../../../src/app/modules/dex/constants';

const { InMemoryPrefixedStateDB } = testing;

describe('dex: offChainEndpointFunctions', () => {
	const poolId: PoolID = Buffer.from('0000000000000000000001000000000000c8', 'hex');
	const senderAddress: Address = Buffer.from('0000000000000000', 'hex');
	const positionId: PositionID = Buffer.from('00000001000000000101643130', 'hex');
	const dexModule = new DexModule();
	const feeTierNumber = Number('0x00000c8');
	const poolIdLSK = Buffer.from('0000000100000000', 'hex');
	const token0Id: TokenID = Buffer.from('0000000000000000', 'hex');
	const token1Id: TokenID = Buffer.from('0000010000000000', 'hex');

	const INVALID_ADDRESS = '1234';
	const tokenMethod = new TokenMethod(dexModule.stores, dexModule.events, dexModule.name);
	// const stateStore: PrefixedStateReadWriter = new PrefixedStateReadWriter(inMemoryPrefixedStateDB);

	const stateStore = new PrefixedStateReadWriter(new InMemoryPrefixedStateDB());

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
	let endpoint: DexEndpoint;

	const transferMock = jest.fn();
	const lockMock = jest.fn();
	const unlockMock = jest.fn();
	const getAvailableBalanceMock = jest.fn().mockReturnValue(BigInt(250));
	const lockedAmountMock = jest.fn().mockReturnValue(BigInt(5));

	const poolsStoreData: PoolsStoreData = {
		liquidity: BigInt(5000000),
		sqrtPrice: q96ToBytes(BigInt(tickToPrice(100))),
		incentivesPerLiquidityAccumulator: q96ToBytes(numberToQ96(BigInt(10))),
		heightIncentivesUpdate: 5,
		feeGrowthGlobal0: q96ToBytes(numberToQ96(BigInt(10))),
		feeGrowthGlobal1: q96ToBytes(numberToQ96(BigInt(10))),
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
		feeGrowthOutside0: q96ToBytes(numberToQ96(BigInt(5))),
		feeGrowthOutside1: q96ToBytes(numberToQ96(BigInt(5))),
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
			endpoint = new DexEndpoint(dexModule.stores, dexModule.offchainStores);

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
				[Buffer.concat([getPoolIDFromPositionID(positionId), tickToBytes(5)])],
				priceTicksStoreDataTickLower,
			);

			await priceTicksStore.setKey(
				methodContext,
				[poolId, tickToBytes(100)],
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

		it('getToken1Amount', async () => {
			await endpoint.getToken1Amount(tokenMethod, moduleEndpointContext, poolId).then(res => {
				expect(res).toBe(BigInt(5));
			});
		});

		it('getToken0Amount', async () => {
			await endpoint.getToken0Amount(tokenMethod, moduleEndpointContext, poolId).then(res => {
				expect(res).toBe(BigInt(5));
			});
		});

		it('should return the feeTier from the poolID', () => {
			expect(endpoint.getFeeTier(poolId)).toEqual(feeTierNumber);
		});

		it.skip('getPoolIDFromTickID', () => {
			expect(
				endpoint.getPoolIDFromTickID(Buffer.from('000000010000000001016431308000000a', 'hex')),
			).toStrictEqual(Buffer.from('00000001000000000101643130800000', 'hex'));
		});

		it('getPositionIndex', () => {
			moduleEndpointContext.params = {
				positionID: positionId.toString('hex'),
			};
			expect(endpoint.getPositionIndex(moduleEndpointContext)).toBe(1);
		});

		it('getAllTokenIDs', async () => {
			await endpoint.getAllTokenIDs(moduleEndpointContext).then(res => {
				expect(res.size).toBeGreaterThan(0);
			});
		});

		it('getAllPositionIDsInPool', () => {
			const positionIDs = endpoint.getAllPositionIDsInPool(getPoolIDFromPositionID(positionId), [
				positionId,
			]);
			expect(positionIDs.indexOf(positionId)).not.toBe(-1);
		});

		it('getTickWithTickId', async () => {
			const tickWithTickID = await endpoint.getTickWithTickId(moduleEndpointContext, [
				getPoolIDFromPositionID(positionId),
				tickToBytes(positionsStoreData.tickLower),
			]);
			expect(tickWithTickID).not.toBeNull();
			expect(tickWithTickID.liquidityNet).toBe(BigInt(5));
		});

		it('getPool', async () => {
			await endpoint
				.getPool(moduleEndpointContext, getPoolIDFromPositionID(positionId))
				.then(res => {
					expect(res).not.toBeNull();
					expect(res.liquidity).toBe(BigInt(5000000));
				});
		});

		it('getCurrentSqrtPrice', async () => {
			moduleEndpointContext.params = {
				poolID: getPoolIDFromPositionID(positionId),
				priceDirection: false,
			};
			expect((await endpoint.getCurrentSqrtPrice(moduleEndpointContext)).toString()).toBe(
				'78833030112140176575862854576',
			);
		});

		it('getDexGlobalData', async () => {
			await endpoint.getDexGlobalData(moduleEndpointContext).then(res => {
				expect(res).not.toBeNull();
				expect(res.positionCounter).toBe(BigInt(15));
			});
		});

		it('getPosition', async () => {
			const positionIdsList = [positionId];
			const newPositionId: PositionID = Buffer.from('00000001000000000101643130', 'hex');
			await positionsStore.set(methodContext, newPositionId, positionsStoreData);
			await positionsStore.setKey(methodContext, [newPositionId], positionsStoreData);
			await endpoint
				.getPosition(moduleEndpointContext, newPositionId, positionIdsList)
				.then(res => {
					expect(res).not.toBeNull();
				});
		});

		it('getTickWithPoolIdAndTickValue', async () => {
			const tickValue = 5;
			// eslint-disable-next-line @typescript-eslint/no-floating-promises
			priceTicksStore.setKey(
				methodContext,
				[
					Buffer.from(
						getPoolIDFromPositionID(positionId).toLocaleString() +
							tickToBytes(tickValue).toLocaleString(),
						'hex',
					),
				],
				priceTicksStoreDataTickUpper,
			);

			const tickWithPoolIdAndTickValue = await endpoint.getTickWithPoolIdAndTickValue(
				methodContext,
				getPoolIDFromPositionID(positionId),
				tickValue,
			);
			expect(tickWithPoolIdAndTickValue).not.toBeNull();
			expect(tickWithPoolIdAndTickValue.liquidityNet).toBe(BigInt(5));
		});

		it('getLSKPrice', async () => {
			const result = Buffer.alloc(4);
			const tempFeeTier = q96ToBytes(
				BigInt(result.writeUInt32BE(dexGlobalStoreData.poolCreationSettings[0].feeTier, 0)),
			);
			await poolsStore.setKey(
				methodContext,
				[getPoolIDFromPositionID(positionId), positionId, tempFeeTier],
				poolsStoreData,
			);
			await poolsStore.setKey(methodContext, [poolIdLSK, poolIdLSK, tempFeeTier], poolsStoreData);
			await poolsStore.setKey(methodContext, [poolIdLSK, positionId, tempFeeTier], poolsStoreData);

			const res = await endpoint.getLSKPrice(
				tokenMethod,
				moduleEndpointContext,
				getPoolIDFromPositionID(positionId),
			);
			expect(res).toBe(BigInt(1));
		});

		it('getTVL', async () => {
			const res = await endpoint.getTVL(
				tokenMethod,
				moduleEndpointContext,
				getPoolIDFromPositionID(positionId),
			);
			expect(res).toBe(BigInt(5));
		});

		it('getAllTicks', async () => {
			await endpoint.getAllTicks(moduleEndpointContext).then(res => {
				expect(res).not.toBeNull();
			});
		});

		it('getAllTickIDsInPool', async () => {
			const key = Buffer.from('000000010000000001016431308000000a', 'hex');
			const allTickIDsInPool = await endpoint.getAllTickIDsInPool(
				moduleEndpointContext,
				endpoint.getPoolIDFromTickID(key),
			);
			let ifKeyExists = false;
			allTickIDsInPool.forEach(tickIdInPool => {
				if (tickIdInPool.equals(key)) {
					ifKeyExists = true;
				}
			});
			expect(ifKeyExists).toBe(true);
		});

		it('dryRunSwapExactIn', async () => {
			const currentTick = priceToTick(bytesToQ96(poolsStoreData.sqrtPrice));
			const currentTickID = q96ToBytes(BigInt(currentTick));
			await poolsStore.setKey(
				methodContext,
				[currentTickID.slice(0, NUM_BYTES_POOL_ID)],
				poolsStoreData,
			);

			await priceTicksStore.setKey(methodContext, [currentTickID], priceTicksStoreDataTickUpper);

			await priceTicksStore.setKey(
				methodContext,
				[Buffer.from('000000000000000000000000000000000000000000000006', 'hex')],
				priceTicksStoreDataTickUpper,
			);

			const amountIn = BigInt(50);
			const minAmountOut = BigInt(10);
			moduleEndpointContext.params = {
				tokenIdIn: token0Id.toString('hex'),
				amountIn: amountIn.toString(),
				tokenIdOut: token1Id.toString('hex'),
				minAmountOut: minAmountOut.toString(),
				swapRoute: [poolId.toString('hex')],
			};
			const result = await endpoint.dryRunSwapExactIn(moduleEndpointContext);
			expect(result).toEqual([BigInt(51), BigInt(50), BigInt(0), BigInt(0)]);
		});

		it('dryRunSwapExactOut', async () => {
			const currentTick = priceToTick(bytesToQ96(poolsStoreData.sqrtPrice));
			const currentTickID = q96ToBytes(BigInt(currentTick));
			await poolsStore.setKey(
				methodContext,
				[currentTickID.slice(0, NUM_BYTES_POOL_ID)],
				poolsStoreData,
			);

			await priceTicksStore.setKey(methodContext, [currentTickID], priceTicksStoreDataTickUpper);

			await priceTicksStore.setKey(
				methodContext,
				[Buffer.from('000000000000000000000000000000000000000000000006', 'hex')],
				priceTicksStoreDataTickUpper,
			);

			const maxAmountIn = BigInt(10);
			const amountOut = BigInt(10);
			moduleEndpointContext.params = {
				tokenIdIn: token0Id.toString('hex'),
				maxAmountIn: maxAmountIn.toString(),
				tokenIdOut: token1Id.toString('hex'),
				amountOut: amountOut.toString(),
				swapRoute: [poolId.toString('hex')],
			};
			const result = await endpoint.dryRunSwapExactOut(moduleEndpointContext);

			expect(result).toStrictEqual([BigInt(10), BigInt(10), BigInt(0), BigInt(0)]);
		});
	});
});
