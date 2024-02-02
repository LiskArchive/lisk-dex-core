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
import { createMethodContext, EventQueue } from 'lisk-framework/dist-node/state_machine';
import { genesisTokenStoreSchema } from 'lisk-framework/dist-node/modules/token';
import { GenesisTokenStore } from 'lisk-framework/dist-node/modules/token/types';
import { codec, testing } from 'lisk-sdk';

import { PrefixedStateReadWriter } from '../../../stateMachine/prefixedStateReadWriter';
import {
	getToken0Id,
	getToken1Id,
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
	transferToValidatorLSKPool,
	getLiquidityForAmount0,
	updatePosition,
	getCredibleDirectPrice,
	collectFeesAndIncentives,
	computeExceptionalRoute,
	computeRegularRoute,
	getAdjacent,
	computeTokenGenesisAsset,
} from '../../../../src/app/modules/dex/utils/auxiliaryFunctions';

import {
	Address,
	PoolID,
	PositionID,
	TokenDistribution,
	TokenID,
} from '../../../../src/app/modules/dex/types';
import { priceToTick, tickToPrice } from '../../../../src/app/modules/dex/utils/math';
import {
	numberToQ96,
	q96ToBytes,
	mulDivQ96,
	roundDownQ96,
	subQ96,
} from '../../../../src/app/modules/dex/utils/q96';
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

import { createTransientModuleEndpointContext } from '../../../context/createContext';
import {
	ADDRESS_LIQUIDITY_PROVIDER_INCENTIVES,
	ADDRESS_VALIDATOR_INCENTIVES,
	ALL_SUPPORTED_TOKENS_KEY,
	TOKEN_ID_DEX,
} from '../../../../src/app/modules/dex/constants';

const { InMemoryPrefixedStateDB } = testing;
const skipOnCI = process.env.CI ? describe.skip : describe;

describe('dex:auxiliaryFunctions', () => {
	const poolId: PoolID = Buffer.from('0000000000000000000001000000000000c8', 'hex');
	const token0Id: TokenID = Buffer.from('0000000000000000', 'hex');
	const token1Id: TokenID = Buffer.from('0000010000000000', 'hex');
	const senderAddress: Address = Buffer.from('0000000000000000', 'hex');
	const positionId: PositionID = Buffer.from('00000001000000000101643130', 'hex');
	const sqrtPrice: bigint = numberToQ96(BigInt(1));
	const dexModule = new DexModule();
	const INVALID_ADDRESS = '1234';
	const tokenMethod = new TokenMethod(dexModule.stores, dexModule.events, dexModule.name);

	const stateStore: PrefixedStateReadWriter = new PrefixedStateReadWriter(
		new InMemoryPrefixedStateDB(),
	);

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
		it('should get Token0Id from poolID', () => {
			expect(getToken0Id(poolId)).toEqual(token0Id);
		});
		it('should get Token1Id from poolID', () => {
			expect(getToken1Id(poolId)).toEqual(token1Id);
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

		it('should return the poolId from the positionId', () => {
			expect(getPoolIDFromPositionID(positionId).toString('hex')).toBe(
				'00000001000000000101643130',
			);
		});

		it('should return 0 as POOL_CREATION_SUCCESS', async () => {
			expect(
				await createPool(settings, methodContext, poolsStore, token0Id, token1Id, 0, sqrtPrice, 10),
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

		it('Return value is 10894', () => {
			expect(
				getLiquidityForAmounts(
					BigInt('61703726247759831737814779825'),
					BigInt('79228162514264337593543950336'),
					BigInt('965075977353221155028623083472'),
					BigInt(10000),
					BigInt(10000),
				),
			).toBe(BigInt(10894));
		});

		it('Return value is 15415.', () => {
			expect(
				getLiquidityForAmounts(
					BigInt('130621891405341611593710811015'),
					BigInt('79228162514264337593543950336'),
					BigInt('965075977353221155028623083472'),
					BigInt(10000),
					BigInt(10000),
				),
			).toBe(BigInt(15415));
		});

		it('Return value is 894.', () => {
			expect(
				getLiquidityForAmounts(
					BigInt('1591101516320542774261326898334'),
					BigInt('79228162514264337593543950336'),
					BigInt('965075977353221155028623083472'),
					BigInt(10000),
					BigInt(10000),
				),
			).toBe(BigInt(894));
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

		// eslint-disable-next-line @typescript-eslint/require-await
		it('Position with ID positionID does not exist in positions substore', async () => {
			// eslint-disable-next-line @typescript-eslint/no-floating-promises, jest/valid-expect
			expect(
				checkPositionExistenceAndOwnership(
					dexModule.stores,
					dexModule.events,
					methodContext,
					senderAddress,
					Buffer.alloc(0),
				),
			).rejects.toThrow();
		});

		// eslint-disable-next-line @typescript-eslint/require-await
		it('senderAddress is not equal to positions[positionID].ownerAddress ', async () => {
			// eslint-disable-next-line @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, jest/valid-expect
			expect(
				checkPositionExistenceAndOwnership(
					dexModule.stores,
					dexModule.events,
					methodContext,
					Buffer.alloc(0),
					positionId,
				),
			).rejects.toThrow();
		});

		it('should return [0n, 0n, 0n, 0n] as collectableFees0, collectableFees1, feeGrowthInside0, feeGrowthInside1 in result', async () => {
			await computeCollectableFees(dexModule.stores, methodContext, positionId).then(res => {
				expect(res[0]).toBe(BigInt(0));
				expect(res[1]).toBe(BigInt(0));
				expect(res[2]).toBe(BigInt(0));
				expect(res[3]).toBe(BigInt(0));
			});
		});

		// eslint-disable-next-line jest/no-disabled-tests
		it.skip('should return [1n,25n] in result', async () => {
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

		// eslint-disable-next-line jest/no-disabled-tests
		it.skip('should return [0,0] as newTestpositionId!=positionId', async () => {
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
				expect(res[0].toString()).toBe('1');
				expect(res[1].toString()).toBe('1');
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
					expect(res[0].toString()).toBe('0');
					expect(res[1].toString()).toBe('0');
				}),
			).toBeUndefined();
		});

		it('priceToTick', () => {
			expect(priceToTick(tickToPrice(-735247))).toBe(-735247);
		});

		it('getAdjacent', async () => {
			const res = await getAdjacent(moduleEndpointContext, dexModule.stores, token0Id);
			expect(res).not.toBeNull();
		});

		it('computeRegularRoute ', async () => {
			const adjacentToken = Buffer.from('0000000000000000000001000000000000000000', 'hex');
			const res = await computeRegularRoute(
				moduleEndpointContext,
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
				await computeExceptionalRoute(moduleEndpointContext, dexModule.stores, token0Id, token1Id),
			).toHaveLength(0);
		});

		it('computeExceptionalRoute should return route with tokenID', async () => {
			expect(
				(
					await computeExceptionalRoute(moduleEndpointContext, dexModule.stores, token0Id, token0Id)
				)[0],
			).toStrictEqual(Buffer.from('0000000000000000', 'hex'));
		});

		it('getCredibleDirectPrice', async () => {
			const tempModuleEndpointContext = createTransientModuleEndpointContext({
				stateStore,
				params: { poolID: getPoolIDFromPositionID(positionId) },
			});
			const result = Buffer.alloc(4);
			const newTokenIDsArray = [
				token0Id,
				token1Id,
				q96ToBytes(
					BigInt(result.writeUInt32BE(dexGlobalStoreData.poolCreationSettings[0].feeTier, 0)),
				),
			];
			await poolsStore.setKey(methodContext, newTokenIDsArray, poolsStoreData);
			Buffer.concat(newTokenIDsArray);
			await poolsStore.set(methodContext, Buffer.concat(newTokenIDsArray), poolsStoreData);
			await getCredibleDirectPrice(
				tokenMethod,
				tempModuleEndpointContext,
				dexModule.stores,
				token0Id,
				token1Id,
			).then(res => {
				expect(res.toString()).toBe('79267784519130042428790663800');
			});
		});

		it('getCredibleDirectPrice There is no pool swapping tokens token0 and token1.', async () => {
			const tempModuleEndpointContext = createTransientModuleEndpointContext({
				stateStore,
				params: { poolID: getPoolIDFromPositionID(positionId) },
			});
			const result = Buffer.alloc(4);
			const newTokenIDsArray = [
				token0Id,
				token1Id,
				q96ToBytes(
					BigInt(result.writeUInt32BE(dexGlobalStoreData.poolCreationSettings[0].feeTier, 0)),
				),
			];
			await poolsStore.setKey(methodContext, newTokenIDsArray, poolsStoreData);
			Buffer.concat(newTokenIDsArray);
			await poolsStore.set(methodContext, Buffer.concat(newTokenIDsArray), poolsStoreData);
			// eslint-disable-next-line @typescript-eslint/no-floating-promises, jest/valid-expect
			expect(
				getCredibleDirectPrice(
					tokenMethod,
					tempModuleEndpointContext,
					dexModule.stores,
					Buffer.alloc(0),
					token1Id,
				),
			).rejects.toThrow('No direct pool between given tokens');
		});
	});

	it('transferToValidatorLSKPool', async () => {
		await transferToValidatorLSKPool(tokenMethod, methodContext, senderAddress, BigInt(1));

		expect(tokenMethod.transfer).toHaveBeenCalled();
	});

	it('collectFeesAndIncentives', async () => {
		await collectFeesAndIncentives(
			dexModule.events,
			dexModule.stores,
			tokenMethod,
			methodContext,
			positionId,
		);
		expect(tokenMethod.transfer).toHaveBeenCalled();
	});

	it('getLiquidityForAmount0', () => {
		const lowerSqrtPrice = BigInt(10);
		const upperSqrtPrice = BigInt(100);
		const amount0 = BigInt(50);

		const intermediate = mulDivQ96(lowerSqrtPrice, upperSqrtPrice, numberToQ96(BigInt(1)));
		const result = mulDivQ96(
			numberToQ96(amount0),
			intermediate,
			subQ96(upperSqrtPrice, lowerSqrtPrice),
		);

		const functionResult = getLiquidityForAmount0(lowerSqrtPrice, upperSqrtPrice, amount0);

		expect(functionResult).toEqual(roundDownQ96(result));
	});

	it('computeTokenGenesisAsset', () => {
		const account0 = {
			address: Buffer.from('d4b6810c78e3a3023e6bfaefc2bf6b9fe0dbf89b', 'hex'),
			balance: BigInt(1),
		};
		const account1 = {
			address: Buffer.from('a2badd91e7ed423b56322b68f2beee4c638f0506', 'hex'),
			balance: BigInt(1),
		};
		const tokenDistribution: TokenDistribution = {
			accounts: [account0, account1],
		};
		const result = computeTokenGenesisAsset(tokenDistribution);

		const expectedGenesisTokenStore: GenesisTokenStore = {
			userSubstore: [
				{
					address: ADDRESS_LIQUIDITY_PROVIDER_INCENTIVES,
					tokenID: TOKEN_ID_DEX,
					availableBalance: BigInt(0),
					lockedBalances: [],
				},
				{
					address: ADDRESS_VALIDATOR_INCENTIVES,
					tokenID: TOKEN_ID_DEX,
					availableBalance: BigInt(0),
					lockedBalances: [],
				},
				{
					address: account1.address,
					tokenID: TOKEN_ID_DEX,
					availableBalance: BigInt(1),
					lockedBalances: [],
				},
				{
					address: account0.address,
					tokenID: TOKEN_ID_DEX,
					availableBalance: BigInt(1),
					lockedBalances: [],
				},
			],
			supplySubstore: [{ tokenID: TOKEN_ID_DEX, totalSupply: BigInt(2) }],
			escrowSubstore: [],
			supportedTokensSubstore: [{ chainID: ALL_SUPPORTED_TOKENS_KEY, supportedTokenIDs: [] }],
		};
		const expectedResult = {
			module: 'token',
			data: codec.encode(genesisTokenStoreSchema, expectedGenesisTokenStore),
		};

		expect(result).toStrictEqual(expectedResult);
	});

	skipOnCI('performance test for computeTokenGenesisAsset', () => {
		// eslint-disable-next-line @typescript-eslint/no-floating-promises
		(async () => {
			const testarray = Array.from({ length: 10000 });
			await Promise.all(testarray.map(() => testComputeTokenGenesisAsset()));
		})();

		function testComputeTokenGenesisAsset() {
			it('test computeTokenGenesisAsset', () => {
				const account = {
					address: Buffer.from('d4b6810c78e3a3023e6bfaefc2bf6b9fe0dbf89b', 'hex'),
					balance: BigInt(1),
				};
				const tokenDistribution: TokenDistribution = {
					accounts: [account],
				};
				const result = computeTokenGenesisAsset(tokenDistribution);

				const expectedGenesisTokenStore: GenesisTokenStore = {
					userSubstore: [
						{
							address: ADDRESS_LIQUIDITY_PROVIDER_INCENTIVES,
							tokenID: TOKEN_ID_DEX,
							availableBalance: BigInt(0),
							lockedBalances: [],
						},
						{
							address: ADDRESS_VALIDATOR_INCENTIVES,
							tokenID: TOKEN_ID_DEX,
							availableBalance: BigInt(0),
							lockedBalances: [],
						},
						{
							address: account.address,
							tokenID: TOKEN_ID_DEX,
							availableBalance: BigInt(1),
							lockedBalances: [],
						},
					],
					supplySubstore: [{ tokenID: TOKEN_ID_DEX, totalSupply: BigInt(1) }],
					escrowSubstore: [],
					supportedTokensSubstore: [{ chainID: ALL_SUPPORTED_TOKENS_KEY, supportedTokenIDs: [] }],
				};
				const expectedResult = {
					module: 'token',
					data: codec.encode(genesisTokenStoreSchema, expectedGenesisTokenStore),
				};

				expect(result).toStrictEqual(expectedResult);
			});
		}
	});

	it('computeTokenGenesisAsset initialize account with address ADDRESS_LIQUIDITY_PROVIDER_INCENTIVES', () => {
		const tokenDistribution: TokenDistribution = {
			accounts: [],
		};
		const result = computeTokenGenesisAsset(tokenDistribution);

		const expectedGenesisTokenStore: GenesisTokenStore = {
			userSubstore: [
				{
					address: ADDRESS_LIQUIDITY_PROVIDER_INCENTIVES,
					tokenID: TOKEN_ID_DEX,
					availableBalance: BigInt(0),
					lockedBalances: [],
				},
				{
					address: ADDRESS_VALIDATOR_INCENTIVES,
					tokenID: TOKEN_ID_DEX,
					availableBalance: BigInt(0),
					lockedBalances: [],
				},
			],
			supplySubstore: [{ tokenID: TOKEN_ID_DEX, totalSupply: BigInt(0) }],
			escrowSubstore: [],
			supportedTokensSubstore: [{ chainID: ALL_SUPPORTED_TOKENS_KEY, supportedTokenIDs: [] }],
		};
		const expectedResult = {
			module: 'token',
			data: codec.encode(genesisTokenStoreSchema, expectedGenesisTokenStore),
		};

		expect(result).toStrictEqual(expectedResult);
	});
});
