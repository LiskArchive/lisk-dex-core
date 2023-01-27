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

import { MethodContext, ModuleEndpointContext } from 'lisk-sdk';
import { PoolsStore, PriceTicksStore } from '../stores';
import { PoolID, PositionID, Q96, TickID, TokenID } from '../types';
import {
  computeCurrentPrice,
  getAllPoolIDs,
  getAllTicks,
  getPool,
  getPoolIDFromPositionID,
  getToken0Id,
  getToken1Id,
} from './auxiliaryFunctions';
import { swap } from './swapFunctions';
import { NamedRegistry } from 'lisk-framework/dist-node/modules/named_registry';
import { bytesToQ96, invQ96 } from './q96';
import { DexGlobalStore, DexGlobalStoreData } from '../stores/dexGlobalStore';
import {
  MAX_HOPS_SWAP,
  MAX_SQRT_RATIO,
  MIN_SQRT_RATIO,
  NUM_BYTES_POOL_ID
} from '../constants';
import { PositionsStore, PositionsStoreData } from '../stores/positionsStore';
import { PriceTicksStoreData, tickToBytes } from '../stores/priceTicksStore';

export const getAllTokenIDs = async (
  methodContext: MethodContext,
  stores: NamedRegistry,
): Promise<Set<TokenID>> => {
  const tokens = new Set<TokenID>();
  const allPoolIds = await getAllPoolIDs(methodContext, stores.get(PoolsStore));

  if (allPoolIds != null && allPoolIds.length > 0) {
    allPoolIds.forEach(poolID => {
      tokens.add(getToken0Id(poolID));
      tokens.add(getToken1Id(poolID));
    });
  }

  return tokens;
};

export const getAllPositionIDsInPool = (
  poolId: PoolID,
  positionIdsList: PositionID[],
): Buffer[] => {
  const result: Buffer[] = [];
  positionIdsList.forEach(positionId => {
    if (getPoolIDFromPositionID(positionId).equals(poolId)) {
      result.push(positionId);
    }
  });
  return result;
};

export const getAllTickIDsInPool = async (
  methodContext: MethodContext,
  stores: NamedRegistry,
  poolId: PoolID,
): Promise<TickID[]> => {
  const result: Buffer[] = [];
  const allTicks = await getAllTicks(methodContext, stores);
  allTicks.forEach(tickID => {
    if (getPoolIDFromTickID(tickID).equals(poolId)) {
      result.push(tickID);
    }
  });
  return result;
};

export const getCurrentSqrtPrice = async (
  methodContext: MethodContext,
  stores: NamedRegistry,
  poolID: PoolID,
  priceDirection: boolean,
): Promise<Q96> => {
  const pools = await getPool(methodContext, stores, poolID);
  if (pools == null) {
    throw new Error();
  }
  const q96SqrtPrice = bytesToQ96(pools.sqrtPrice);
  if (priceDirection) {
    return q96SqrtPrice;
  }
  return invQ96(q96SqrtPrice);
};

export const getDexGlobalData = async (
  methodContext: MethodContext,
  stores: NamedRegistry,
): Promise<DexGlobalStoreData> => {
  const dexGlobalStore = stores.get(DexGlobalStore);
  return dexGlobalStore.get(methodContext, Buffer.from([]));
};

export const getPoolIDFromTickID = (tickID: TickID) => tickID.slice(0, NUM_BYTES_POOL_ID);

export const getPosition = async (
  methodContext: MethodContext,
  stores: NamedRegistry,
  positionID: PositionID,
  positionIdsList: PositionID[],
): Promise<PositionsStoreData> => {
  if (positionIdsList.includes(positionID)) {
    throw new Error();
  }
  const positionsStore = stores.get(PositionsStore);
  const positionStoreData = await positionsStore.get(methodContext, positionID);
  return positionStoreData;
};

export const getTickWithTickId = async (
  methodContext: MethodContext,
  stores: NamedRegistry,
  tickId: TickID[],
) => {
  const priceTicksStore = stores.get(PriceTicksStore);
  const priceTicksStoreData = await priceTicksStore.getKey(methodContext, tickId);
  if (priceTicksStoreData == null) {
    throw new Error('No tick with the specified poolId');
  } else {
    return priceTicksStoreData;
  }
};

export const getTickWithPoolIdAndTickValue = async (
  methodContext: MethodContext,
  stores: NamedRegistry,
  poolId: PoolID,
  tickValue: number,
): Promise<PriceTicksStoreData> => {
  const priceTicksStore = stores.get(PriceTicksStore);
  const key = poolId.toLocaleString() + tickToBytes(tickValue).toLocaleString();
  const priceTicksStoreData = await priceTicksStore.get(methodContext, Buffer.from(key, 'hex'));
  if (priceTicksStoreData == null) {
    throw new Error('No tick with the specified poolId and tickValue');
  } else {
    return priceTicksStoreData;
  }
};

export const dryRunSwapExactIn = async (
  methodContext: MethodContext,
  moduleEndpointContext: ModuleEndpointContext,
  stores: NamedRegistry,
  tokenIdIn: TokenID,
  amountIn: bigint,
  tokenIdOut: TokenID,
  minAmountOut: bigint,
  swapRoute: PoolID[],
): Promise<[bigint, bigint, bigint, bigint]> => {
  let zeroToOne = false;
  let IdOut: TokenID = tokenIdIn;
  const tokens = [{ id: tokenIdIn, amount: amountIn }];
  const fees = [{}];
  let amountOut: bigint;
  let feesIn: bigint;
  let feesOut: bigint;
  let priceBefore: bigint;
  let newAmountIn = BigInt(0);

  if (tokenIdIn === tokenIdOut || swapRoute.length === 0 || swapRoute.length > MAX_HOPS_SWAP) {
    throw new Error('Invalid parameters');
  }
  try {
    priceBefore = await computeCurrentPrice(
      methodContext,
      stores,
      tokenIdIn,
      tokenIdOut,
      swapRoute,
    );
  } catch (error) {
    throw new Error('Invalid swap route');
  }

  for (const poolId of swapRoute) {
    const currentTokenIn = tokens[-1];

    if (getToken0Id(poolId).equals(currentTokenIn.id)) {
      zeroToOne = true;
      IdOut = getToken1Id(poolId);
    } else if (getToken1Id(poolId).equals(currentTokenIn.id)) {
      zeroToOne = false;
      IdOut = getToken0Id(poolId);
    }
    const sqrtLimitPrice = zeroToOne ? MIN_SQRT_RATIO : MAX_SQRT_RATIO;
    const currentHeight = 10;
    try {
      [newAmountIn, amountOut, feesIn, feesOut] = await swap(
        moduleEndpointContext,
        methodContext,
        stores,
        poolId,
        zeroToOne,
        sqrtLimitPrice,
        currentTokenIn.amount,
        false,
        currentHeight,
        tokenIdIn,
        tokenIdOut,
      );
    } catch (error) {
      throw new Error('Crossed too many ticks');
    }
    tokens.push({ id: IdOut, amount: amountOut });
    fees.push({ in: feesIn, out: feesOut });
  }

  if (tokens[-1].amount < minAmountOut) {
    throw new Error('Too low output amount');
  }
  const priceAfter = await computeCurrentPrice(
    methodContext,
    stores,
    tokenIdIn,
    tokenIdOut,
    swapRoute,
  );
  return [newAmountIn, tokens[-1].amount, priceBefore, priceAfter];
};