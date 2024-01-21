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

import { TokenMethod, testing } from 'lisk-sdk';
import { createMethodContext, EventQueue } from 'lisk-framework/dist-node/state_machine';
import { MethodContext } from 'lisk-framework/dist-node/state_machine/method_context';
import { DexModule } from '../../../../src/app/modules';
import {
	computeCurrentPrice,
	computeRegularRoute,
	computeExceptionalRoute,
	constructPoolsGraph,
	crossTick,
	getAdjacent,
	swap,
	swapWithin,
	transferFeesFromPool,
	getOptimalSwapPool,
	getRoute,
	raiseSwapException,
	computeNewIncentivesPerLiquidity,
	updatePoolIncentives,
} from '../../../../src/app/modules/dex/utils/swapFunctions';
import { Address, PoolID, TokenID } from '../../../../src/app/modules/dex/types';
import { createTransientModuleEndpointContext } from '../../../context/createContext';
import { PrefixedStateReadWriter } from '../../../stateMachine/prefixedStateReadWriter';
import { bytesToQ96, numberToQ96, q96ToBytes } from '../../../../src/app/modules/dex/utils/q96';
import { priceToTick, tickToPrice } from '../../../../src/app/modules/dex/utils/math';
import {
	DexGlobalStore,
	PoolsStore,
	PriceTicksStore,
} from '../../../../src/app/modules/dex/stores';
import { PoolsStoreData } from '../../../../src/app/modules/dex/stores/poolsStore';
import { DexGlobalStoreData } from '../../../../src/app/modules/dex/stores/dexGlobalStore';
import { NUM_BYTES_POOL_ID, TOKEN_ID_LSK } from '../../../../src/app/modules/dex/constants';
import {
	PriceTicksStoreData,
	tickToBytes,
} from '../../../../src/app/modules/dex/stores/priceTicksStore';

const { InMemoryPrefixedStateDB } = testing;

describe('dex:swapFunctions', () => {
	const poolID: PoolID = Buffer.from('0000000000000000000001000000000000c8', 'hex');
	const poolIdLSK = Buffer.from('0000000100000000', 'hex');
	const token0Id: TokenID = Buffer.from('0000000000000000', 'hex');
	const token1Id: TokenID = Buffer.from('0000010000000000', 'hex');
	const amount = 0;
	const sqrtCurrentPrice = BigInt(5);
	const sqrtTargetPrice = BigInt(10);
	const sqrtLimitPrice = BigInt(15);
	const liquidity = BigInt(100);
	const amountRemaining = BigInt(90);
	const exactInput = true;
	const dexModule = new DexModule();
	const inMemoryPrefixedStateDB = new InMemoryPrefixedStateDB();
	const stateStore: PrefixedStateReadWriter = new PrefixedStateReadWriter(inMemoryPrefixedStateDB);
	const INVALID_ADDRESS = '1234';
	const tokenMethod = new TokenMethod(dexModule.stores, dexModule.events, dexModule.name);
	const senderAddress: Address = Buffer.from('0000000000000000', 'hex');

	const transferMock = jest.fn();
	const lockMock = jest.fn();
	const unlockMock = jest.fn();

	let poolsStore: PoolsStore;
	let dexGlobalStore: DexGlobalStore;
	let priceTicksStore: PriceTicksStore;

	const methodContext: MethodContext = createMethodContext({
		contextStore: new Map(),
		stateStore,
		eventQueue: new EventQueue(0),
	});

	const moduleEndpointContext = createTransientModuleEndpointContext({
		stateStore,
		params: { address: INVALID_ADDRESS },
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

	describe('constructor', () => {
		beforeEach(async () => {
			poolsStore = dexModule.stores.get(PoolsStore);
			dexGlobalStore = dexModule.stores.get(DexGlobalStore);
			priceTicksStore = dexModule.stores.get(PriceTicksStore);

			await poolsStore.setKey(methodContext, [poolID], poolsStoreData);
			await poolsStore.setKey(methodContext, [poolIdLSK], poolsStoreData);

			await dexGlobalStore.set(methodContext, Buffer.from([]), dexGlobalStoreData);

			tokenMethod.transfer = transferMock;
			tokenMethod.lock = lockMock;
			tokenMethod.unlock = unlockMock;
		});
		it('raiseSwapException', () => {
			try {
				raiseSwapException(dexModule.events, methodContext, 1, token0Id, token1Id, senderAddress);
			} catch (error) {
				const swapFailedEvent = dexModule.events.values().filter(e => e.name === 'swapFailed');
				expect(swapFailedEvent).toHaveLength(1);
			}
		});

		it('swapWithin', () => {
			const [sqrtUpdatedPrice, amountIn, amountOut] = swapWithin(
				sqrtCurrentPrice,
				sqrtTargetPrice,
				liquidity,
				amountRemaining,
				exactInput,
			);
			expect(sqrtUpdatedPrice).toBe(BigInt(10));
			expect(amountIn).toBe(BigInt(1));
			expect(amountOut).toBe(BigInt(792281625142643375935439503360));
		});
		it('getAdjacent', () => {
			const adjacent = getAdjacent(moduleEndpointContext, dexModule.stores, token0Id);
			expect(adjacent).not.toBeNull();
		});

		it('computeCurrentPrice', async () => {
			const tempModuleEndpointContext = createTransientModuleEndpointContext({
				stateStore,
				params: { poolID },
			});
			const swapRoute = [poolID];
			const currentPrice = await computeCurrentPrice(
				tempModuleEndpointContext,
				dexModule.stores,
				token0Id,
				token1Id,
				swapRoute,
			);
			expect(currentPrice).not.toBeNull();
		});

		it('constructPoolsGraph', async () => {
			const poolsGraph = await constructPoolsGraph(moduleEndpointContext, dexModule.stores);
			const vertices: Buffer[] = [];
			const edges: Buffer[] = [];

			poolsGraph.vertices.forEach(e => {
				vertices.push(e);
			});
			poolsGraph.edges.forEach(e => {
				edges.push(e);
			});

			expect(vertices.filter(vertex => vertex.equals(token0Id))).toHaveLength(1);
			expect(vertices.filter(vertex => vertex.equals(token1Id))).toHaveLength(1);
			expect(edges.filter(edge => edge.equals(poolID))).toHaveLength(1);
		});
		it('crossTick', async () => {
			const currentTick = priceToTick(bytesToQ96(poolsStoreData.sqrtPrice));
			const currentTickID = q96ToBytes(BigInt(currentTick));
			await poolsStore.setKey(
				methodContext,
				[currentTickID.slice(0, NUM_BYTES_POOL_ID)],
				poolsStoreData,
			);
			await priceTicksStore.setKey(methodContext, [currentTickID], priceTicksStoreDataTickUpper);
			const crossTickRes = crossTick(methodContext, dexModule.stores, currentTickID, false, 10);
			// eslint-disable-next-line @typescript-eslint/no-floating-promises, jest/valid-expect
			expect(crossTickRes).resolves.toBeUndefined();
		});

		it('transferFeesFromPool', () => {
			expect(
				transferFeesFromPool(tokenMethod, methodContext, amount, TOKEN_ID_LSK, poolID),
			).toBeUndefined();
		});

		it('computeRegularRoute ', async () => {
			const adjacentToken = Buffer.from('0000000100000000', 'hex');
			const regularRoute = await computeRegularRoute(
				moduleEndpointContext,
				dexModule.stores,
				adjacentToken,
				adjacentToken,
			);
			expect(regularRoute).toStrictEqual([adjacentToken, adjacentToken, adjacentToken]);
		});

		it('computeExceptionalRoute should return route with tokenID', async () => {
			expect(
				(
					await computeExceptionalRoute(moduleEndpointContext, dexModule.stores, token0Id, token0Id)
				)[0],
			).toStrictEqual(token0Id);
		});

		it('computeNewIncentivesPerLiquidity should throw when poolId is not in the list of incentivized pools', async () => {
			await expect(
				computeNewIncentivesPerLiquidity(
					moduleEndpointContext,
					dexModule.stores,
					Buffer.alloc(0),
					1,
				),
			).rejects.toThrow('Invalid arguments');
		});

		it('updatePoolIncentives should not throw', async () => {
			await expect(
				updatePoolIncentives(moduleEndpointContext, dexModule.stores, Buffer.alloc(0), 1),
			).resolves.not.toThrow();
		});
		it('swap', async () => {
			const currentTick = priceToTick(bytesToQ96(poolsStoreData.sqrtPrice));
			const currentTickID = q96ToBytes(BigInt(currentTick));
			const poolIDAndTickID = Buffer.concat([poolID, tickToBytes(currentTick)]);

			await poolsStore.setKey(
				methodContext,
				[currentTickID.slice(0, NUM_BYTES_POOL_ID)],
				poolsStoreData,
			);

			await priceTicksStore.setKey(methodContext, [currentTickID], priceTicksStoreDataTickUpper);

			await priceTicksStore.setKey(methodContext, [poolIDAndTickID], priceTicksStoreDataTickUpper);

			await priceTicksStore.setKey(
				methodContext,
				[Buffer.from('000000000000000000000000000000000000000000000006', 'hex')],
				priceTicksStoreDataTickUpper,
			);

			await priceTicksStore.setKey(
				methodContext,
				[Buffer.from(poolID.toLocaleString() + tickToBytes(100).toLocaleString(), 'hex')],
				priceTicksStoreDataTickUpper,
			);

			q96ToBytes(BigInt(currentTick));
			expect(
				await swap(
					methodContext,
					dexModule.stores,
					poolID,
					true,
					sqrtLimitPrice,
					BigInt(5),
					true,
					10,
				),
			).toStrictEqual([BigInt(5), BigInt(5), BigInt(0), BigInt(0), 1]);
			expect(
				await swap(
					methodContext,
					dexModule.stores,
					poolID,
					true,
					sqrtLimitPrice,
					BigInt(5),
					false,
					10,
				),
			).toStrictEqual([BigInt(6), BigInt(5), BigInt(0), BigInt(0), 1]);
		});

		it('getOptimalSwapPool should return route with tokenID', async () => {
			const tokensArray = [token0Id, token1Id];
			const concatedTokenIDs = Buffer.concat(tokensArray);
			const tokenIDAndSettingsArray = [
				concatedTokenIDs,
				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
				q96ToBytes(numberToQ96(BigInt(dexGlobalStoreData.poolCreationSettings[0].feeTier))),
			];

			const currentTick = priceToTick(bytesToQ96(poolsStoreData.sqrtPrice));

			const potentialPoolId: Buffer = Buffer.concat(tokenIDAndSettingsArray);
			const poolIDAndTickID = Buffer.concat([potentialPoolId, tickToBytes(currentTick)]);
			await priceTicksStore.setKey(methodContext, [poolIDAndTickID], priceTicksStoreDataTickUpper);

			await poolsStore.set(methodContext, potentialPoolId, poolsStoreData);
			let res = await getOptimalSwapPool(
				moduleEndpointContext,
				dexModule.stores,
				token0Id,
				token1Id,
				BigInt(10),
				false,
			);

			expect(res[0]).toStrictEqual(potentialPoolId);
			expect(res[1]).toBe(BigInt(10));

			res = await getOptimalSwapPool(
				moduleEndpointContext,
				dexModule.stores,
				token0Id,
				token1Id,
				BigInt(15),
				true,
			);
			expect(res[0]).toStrictEqual(potentialPoolId);
			expect(res[1]).toBe(BigInt(15));
		});

		it('getRoute', async () => {
			const adjacentToken = Buffer.from('0000000100000000', 'hex');
			const tokensArray = [adjacentToken, adjacentToken];
			const concatedTokenIDs = Buffer.concat(tokensArray);
			const tokenIDAndSettingsArray = [
				concatedTokenIDs,
				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
				q96ToBytes(numberToQ96(BigInt(dexGlobalStoreData.poolCreationSettings[0].feeTier))),
			];

			const currentTick = priceToTick(bytesToQ96(poolsStoreData.sqrtPrice));

			const potentialPoolId: Buffer = Buffer.concat(tokenIDAndSettingsArray);
			const poolIDAndTickID = Buffer.concat([potentialPoolId, tickToBytes(currentTick)]);
			await priceTicksStore.setKey(methodContext, [poolIDAndTickID], priceTicksStoreDataTickUpper);

			await poolsStore.set(methodContext, potentialPoolId, poolsStoreData);
			let bestRoute = await getRoute(
				moduleEndpointContext,
				dexModule.stores,
				adjacentToken,
				adjacentToken,
				BigInt(15),
				false,
			);
			expect(bestRoute).toStrictEqual([potentialPoolId, potentialPoolId, potentialPoolId]);

			bestRoute = await getRoute(
				moduleEndpointContext,
				dexModule.stores,
				adjacentToken,
				adjacentToken,
				BigInt(15),
				true,
			);
			expect(bestRoute).toStrictEqual([potentialPoolId, potentialPoolId, potentialPoolId]);
		});
	});
});
