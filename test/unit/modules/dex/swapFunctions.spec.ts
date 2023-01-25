import { MethodContext, TokenMethod } from 'lisk-framework';
import { PrefixedStateReadWriter } from 'lisk-framework/dist-node/state_machine/prefixed_state_read_writer';
import { createMethodContext, EventQueue } from 'lisk-framework/dist-node/state_machine';

import {
  getRoute,
  getOptimalSwapPool
} from '../../../../src/app/modules/dex/utils/swapFunctions';
import {
  getPoolIDFromPositionID,
  computeExceptionalRoute,
  computeRegularRoute,
} from '../../../../src/app/modules/dex/utils/auxiliaryFunctions';

import { Address, PoolID, PositionID, TokenID } from '../../../../src/app/modules/dex/types';
import { tickToPrice } from '../../../../src/app/modules/dex/utils/math';
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

describe('dex:swapFunctions', () => {
  const poolId: PoolID = Buffer.from('0000000000000000000001000000000000c8', 'hex');
  const token0Id: TokenID = Buffer.from('0000000000000000', 'hex');
  const token1Id: TokenID = Buffer.from('0000010000000000', 'hex');
  const poolIdLSK = Buffer.from('0000000100000000', 'hex');
  const senderAddress: Address = Buffer.from('0000000000000000', 'hex');
  const positionId: PositionID = Buffer.from('00000001000000000101643130', 'hex');
  // const feeTier = Number('0x00000c8');
  // const sqrtPrice: bigint = numberToQ96(BigInt(1));
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

    it('getRoute', async () => {
      const amount = BigInt(1000);
      const exactIn = true;
      const tokenIds: TokenID[] = await getRoute(
        methodContext,
        dexModule.stores,
        token0Id,
        token1Id,
        amount,
        exactIn
      );
      const regularRoute = await computeRegularRoute(
        methodContext,
        dexModule.stores,
        token0Id,
        token1Id
      ); // regularRoute.length = 0

      const exceptionalRoute = await computeExceptionalRoute(
        methodContext,
        dexModule.stores,
        token0Id,
        token1Id
      ); // exceptionalRoute.length = 0;

      let resultTokenIds: TokenID[] = [];
      let bestRoute = [] as Buffer[];
      if (regularRoute.length === 0 && exceptionalRoute.length === 0) {
        resultTokenIds = [] as TokenID[];
      }

      if (regularRoute.length > 0) {
        for (const regularRouteRt of regularRoute) {
          let poolTokenIn = token0Id;
          let poolAmountIn = amount;
          const [optimalPool, poolAmountout] = await getOptimalSwapPool(
            methodContext,
            dexModule.stores,
            poolTokenIn,
            regularRouteRt,
            poolAmountIn,
            exactIn
          );
          bestRoute = bestRoute.concat(optimalPool);
          poolTokenIn = regularRouteRt;
          poolAmountIn = poolAmountout;
        }
        resultTokenIds = bestRoute;
      }
      expect(tokenIds.length).toBe(resultTokenIds.length);
    })
  })
})