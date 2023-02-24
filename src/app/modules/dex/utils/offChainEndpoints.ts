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

import { MethodContext } from 'lisk-sdk';
import { NamedRegistry } from 'lisk-framework/dist-node/modules/named_registry';
import { PriceTicksStore } from '../stores';
import { PoolID, PositionID, TickID } from '../types';
import {
	getPoolIDFromPositionID,
} from './auxiliaryFunctions';
import { DexGlobalStore, DexGlobalStoreData } from '../stores/dexGlobalStore';
import { NUM_BYTES_POOL_ID } from '../constants';
import { PositionsStore, PositionsStoreData } from '../stores/positionsStore';
import { PriceTicksStoreData, tickToBytes } from '../stores/priceTicksStore';

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
