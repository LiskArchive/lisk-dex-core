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
import { NamedRegistry } from 'lisk-framework/dist-node/modules/named_registry';
import { MethodContext } from 'lisk-sdk';
import { DexGlobalStore, PoolsStore } from '../stores';
import { PoolID } from '../types';
import { getAllPoolIDs, getPool } from './auxiliaryFunctions';
import { addQ96, bytesToQ96, divQ96, mulDivQ96, numberToQ96, q96ToBytes } from './q96';

export const computeNewIncentivesPerLiquidity = async (
	methodContext: MethodContext,
	stores: NamedRegistry,
	poolID: PoolID,
	currentHeight: number,
): Promise<bigint> => {
	const dexGlobalStore = stores.get(DexGlobalStore);
	const dexGlobalStoreData = await dexGlobalStore.get(methodContext, Buffer.from([]));
	let incentivizedPools: { poolId: Buffer; multiplier: number } | undefined;

	dexGlobalStoreData.incentivizedPools.forEach(incentivizedPool => {
		if (incentivizedPool.poolId.equals(poolID)) {
			incentivizedPools = incentivizedPool;
		}
	});

	if (incentivizedPools == null) {
		throw new Error('Invalid arguments');
	}

	const pool = await getPool(methodContext, stores, poolID);
	const allPoolIds = await getAllPoolIDs(methodContext, stores.get(PoolsStore));
	if (!allPoolIds.includes(poolID) || pool.heightIncentivesUpdate >= currentHeight) {
		throw new Error('Invalid arguments');
	}

	const poolMultiplier = BigInt(incentivizedPools.multiplier);
	const totalIncentives = BigInt(0);

	const incentives = mulDivQ96(
		numberToQ96(totalIncentives),
		numberToQ96(poolMultiplier),
		numberToQ96(BigInt(dexGlobalStoreData.totalIncentivesMultiplier)),
	)
	const incentivesPerLiquidity = divQ96(incentives, numberToQ96(pool.liquidity));
	const currentIncentivesPerLiquidity = bytesToQ96(pool.incentivesPerLiquidityAccumulator);
	return addQ96(incentivesPerLiquidity, currentIncentivesPerLiquidity);
};

export const updatePoolIncentives = async (
	methodContext: MethodContext,
	stores: NamedRegistry,
	poolID: PoolID,
	currentHeight: number,
) => {
	const dexGlobalStore = stores.get(DexGlobalStore);
	const dexGlobalStoreData = await dexGlobalStore.get(methodContext, Buffer.from([]));
	let incentivizedPools: { poolId: Buffer; multiplier: number } | undefined;

	dexGlobalStoreData.incentivizedPools.forEach(incentivizedPool => {
		if (incentivizedPool.poolId.equals(poolID)) {
			incentivizedPools = incentivizedPool;
		}
	});

	if (incentivizedPools == null) {
		return;
	}

	const pool = await getPool(methodContext, stores, poolID);
	const allPoolIds = await getAllPoolIDs(methodContext, stores.get(PoolsStore));
	if (!allPoolIds.includes(poolID) || pool.heightIncentivesUpdate >= currentHeight) {
		return;
	}

	const newIncentivesPerLiquidity = await computeNewIncentivesPerLiquidity(
		methodContext,
		stores,
		poolID,
		currentHeight,
	);
	pool.incentivesPerLiquidityAccumulator = q96ToBytes(newIncentivesPerLiquidity);
	pool.heightIncentivesUpdate = currentHeight.valueOf();
};
