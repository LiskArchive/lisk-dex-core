/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
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

import { MethodContext, TokenMethod, ModuleEndpointContext } from 'lisk-sdk';
import { MAX_SINT32 } from '@liskhq/lisk-validator';
import { NamedRegistry } from 'lisk-framework/dist-node/modules/named_registry';
import { DexGlobalStore, PoolsStore } from '../stores';
import { PoolID, TokenID } from '../types';
import { getAllPoolIDs, getPool } from './auxiliaryFunctions';
import {
	addQ96,
	bytesToQ96,
	divQ96,
	mulDivQ96,
	numberToQ96,
	q96ToBytes,
	mulQ96,
	roundDownQ96,
} from './q96';
import { DexModule } from '../module';
import { DexEndpoint } from '../endpoint';

export const computeNewIncentivesPerLiquidity = async (
	methodContext: MethodContext,
	stores: NamedRegistry,
	poolID: PoolID,
	currentHeight: number,
): Promise<bigint> => {
	const dexGlobalStore = stores.get(DexGlobalStore);
	const dexGlobalStoreData = await dexGlobalStore.get(methodContext, Buffer.from([]));
	let incentivizedPools: { poolId: Buffer; multiplier: number } | undefined;
	let pooldIDFlag = false;

	dexGlobalStoreData.incentivizedPools.forEach(incentivizedPool => {
		if (incentivizedPool.poolId.equals(poolID)) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			incentivizedPools = incentivizedPool;
		}
	});

	if (incentivizedPools == null) {
		throw new Error('Invalid arguments');
	}

	const pool = await getPool(methodContext, stores, poolID);
	const allPoolIds = await getAllPoolIDs(methodContext, stores.get(PoolsStore));

	for (const poolIDItem of allPoolIds) {
		if (poolIDItem.equals(poolID)) {
			pooldIDFlag = true;
		}
	}

	if (!pooldIDFlag || pool.heightIncentivesUpdate >= currentHeight) {
		throw new Error('Invalid arguments');
	}

	const poolMultiplier = BigInt(incentivizedPools.multiplier);
	const totalIncentives = BigInt(0);

	const incentives = mulDivQ96(
		numberToQ96(totalIncentives),
		numberToQ96(poolMultiplier),
		numberToQ96(BigInt(dexGlobalStoreData.totalIncentivesMultiplier)),
	);
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
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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

// token-Ecnomics-Functions
export const getCredibleDirectPrice = async (
	tokenMethod: TokenMethod,
	methodContext: ModuleEndpointContext,
	stores: NamedRegistry,
	tokenID0: TokenID,
	tokenID1: TokenID,
): Promise<bigint> => {
	const directPools: Buffer[] = [];
	const dexModule = new DexModule();
	const endpoint = new DexEndpoint(stores, dexModule.offchainStores);
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const settings = (await endpoint.getDexGlobalData(methodContext)).poolCreationSettings;
	const allpoolIDs = await endpoint.getAllPoolIDs(methodContext);

	const tokenIDArrays = [tokenID0, tokenID1];
	// eslint-disable-next-line @typescript-eslint/require-array-sort-compare, no-param-reassign
	[tokenID0, tokenID1] = tokenIDArrays.sort();
	const concatedTokenIDs = Buffer.concat([tokenID0, tokenID1]);

	settings.forEach(setting => {
		const result = Buffer.alloc(4);
		const tokenIDAndSettingsArray = [
			concatedTokenIDs,
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
			q96ToBytes(BigInt(result.writeUInt32BE(setting.feeTier, 0))),
		];
		const potentialPoolId: Buffer = Buffer.concat(tokenIDAndSettingsArray);
		allpoolIDs.forEach(poolId => {
			if (poolId.equals(potentialPoolId)) {
				directPools.push(potentialPoolId);
			}
		});
	});

	if (directPools.length === 0) {
		throw new Error('No direct pool between given tokens');
	}

	const token1ValuesLocked: bigint[] = [];

	for (const directPool of directPools) {
		const pool = await endpoint.getPool(methodContext, directPool);
		const token0Amount = await endpoint.getToken0Amount(tokenMethod, methodContext, directPool);
		const token0ValueQ96 = mulQ96(
			mulQ96(numberToQ96(token0Amount), bytesToQ96(pool.sqrtPrice)),
			bytesToQ96(pool.sqrtPrice),
		);
		token1ValuesLocked.push(
			roundDownQ96(token0ValueQ96) +
				(await endpoint.getToken1Amount(tokenMethod, methodContext, directPool)),
		);
	}

	let minToken1ValueLocked = BigInt(MAX_SINT32);
	let minToken1ValueLockedIndex = 0;
	token1ValuesLocked.forEach((token1ValueLocked, index) => {
		if (token1ValueLocked > minToken1ValueLocked) {
			minToken1ValueLocked = token1ValueLocked;
			minToken1ValueLockedIndex = index;
		}
	});

	const poolSqrtPrice = (
		await endpoint.getPool(methodContext, directPools[minToken1ValueLockedIndex])
	).sqrtPrice;
	return mulQ96(bytesToQ96(poolSqrtPrice), bytesToQ96(poolSqrtPrice));
};
