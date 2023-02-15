/* eslint-disable import/no-cycle */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable jest/no-try-expect */

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

import { TokenMethod } from 'lisk-sdk';
import { createMethodContext, EventQueue } from 'lisk-framework/dist-node/state_machine';
import { MethodContext } from 'lisk-framework/dist-node/state_machine/method_context';
import { DexModule } from '../../../../src/app/modules';
import {
  computeCurrentPrice,
  computeRegularRoute,
  constructPoolsGraph,
  getAdjacent,
  swapWithin,
  transferFeesFromPool,
} from '../../../../src/app/modules/dex/utils/swapFunctions';
import { InMemoryPrefixedStateDB } from './inMemoryPrefixedState';
import { PoolID, TokenID } from '../../../../src/app/modules/dex/types';
import { createTransientModuleEndpointContext } from '../../../context/createContext';
import { PrefixedStateReadWriter } from '../../../stateMachine/prefixedStateReadWriter';
import { numberToQ96, q96ToBytes } from '../../../../src/app/modules/dex/utils/q96';
import { tickToPrice } from '../../../../src/app/modules/dex/utils/math';
import {
  DexGlobalStore,
  PoolsStore,
} from '../../../../src/app/modules/dex/stores';
import { PoolsStoreData } from '../../../../src/app/modules/dex/stores/poolsStore';
import { TOKEN_ID_LSK } from '../../../../src/app/modules/dexRewards/constants';
import { DexGlobalStoreData } from '../../../../src/app/modules/dex/stores/dexGlobalStore';
import { computeExceptionalRoute } from '../../../../src/app/modules/dex/utils/auxiliaryFunctions';

describe('dex:swapFunctions', () => {
  const poolId: PoolID = Buffer.from('0000000000000000000001000000000000c8', 'hex');
  const poolIdLSK = Buffer.from('0000000100000000', 'hex');
  const token0Id: TokenID = Buffer.from('0000000000000000', 'hex');
  const token1Id: TokenID = Buffer.from('0000010000000000', 'hex');
  const amount = 0;
  const sqrtCurrentPrice = BigInt(5);
  const sqrtTargetPrice = BigInt(10);
  const liquidity = BigInt(100);
  const amountRemaining = BigInt(90);
  const exactInput = true;
  const dexModule = new DexModule();
  const inMemoryPrefixedStateDB = new InMemoryPrefixedStateDB();
  const stateStore: PrefixedStateReadWriter = new PrefixedStateReadWriter(inMemoryPrefixedStateDB);
  const INVALID_ADDRESS = '1234';
  const tokenMethod = new TokenMethod(dexModule.stores, dexModule.events, dexModule.name);

  const transferMock = jest.fn();
  const lockMock = jest.fn();
  const unlockMock = jest.fn();

  let poolsStore: PoolsStore;
  let dexGlobalStore: DexGlobalStore;

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
    collectableLSKFees: BigInt(10),
    poolCreationSettings: [{ feeTier: 100, tickSpacing: 1 }],
    incentivizedPools: [{ poolId, multiplier: 10 }],
    totalIncentivesMultiplier: 1,
  };

  describe('constructor', () => {
    beforeEach(async () => {
      poolsStore = dexModule.stores.get(PoolsStore);
      dexGlobalStore = dexModule.stores.get(DexGlobalStore);

      await poolsStore.setKey(methodContext, [poolId], poolsStoreData);
      await poolsStore.setKey(methodContext, [poolIdLSK], poolsStoreData);

      await dexGlobalStore.set(methodContext, Buffer.from([]), dexGlobalStoreData);

      tokenMethod.transfer = transferMock;
      tokenMethod.lock = lockMock;
      tokenMethod.unlock = unlockMock;
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
      const swapRoute = [poolId];
      const currentPrice = await computeCurrentPrice(
        moduleEndpointContext,
        dexModule.stores,
        token0Id,
        token1Id,
        swapRoute,
      );
      expect(currentPrice).not.toBeNull();
    });

    it('constructPoolsGraph', async () => {
      const poolsGraph = await constructPoolsGraph(methodContext, dexModule.stores);
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
      expect(edges.filter(edge => edge.equals(poolId))).toHaveLength(1);
    });

    it('transferFeesFromPool', () => {
      expect(
        transferFeesFromPool(tokenMethod, methodContext, amount, TOKEN_ID_LSK, poolId),
      ).toBeUndefined();
    });

    it('computeRegularRoute ', async () => {
      const adjacentToken = Buffer.from('0000000100000000', 'hex');
      const regularRoute = await computeRegularRoute(
        methodContext,
        dexModule.stores,
        adjacentToken,
        adjacentToken,
      );
      expect(regularRoute).toStrictEqual([adjacentToken, adjacentToken, adjacentToken]);
    });

    it('computeExceptionalRoute should return 0', async () => {
      expect(
        await computeExceptionalRoute(methodContext, dexModule.stores, token0Id, token1Id),
      ).toHaveLength(0);
    });

    it('computeExceptionalRoute should return route with tokenID', async () => {
      expect(
        (
          await computeExceptionalRoute(methodContext, dexModule.stores, token0Id, token0Id)
        )[0],
      ).toStrictEqual(token0Id);
    });
  });
});