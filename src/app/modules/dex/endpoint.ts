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

import { BaseEndpoint, MethodContext, TokenMethod } from 'lisk-sdk';

import { MODULE_ID_DEX, NUM_BYTES_POOL_ID, TOKEN_ID_LSK } from './constants';
import { NUM_BYTES_ADDRESS, NUM_BYTES_POSITION_ID } from './constants';
import { PoolsStore, PriceTicksStore } from './stores';
import { PoolID, PositionID, Q96, TickID, TokenID } from './types';
import { NamedRegistry } from 'lisk-framework/dist-node/modules/named_registry';
import { getPoolIDFromPositionID, getToken0Id, getToken1Id, poolIdToAddress } from './utils/auxiliaryFunctions';
import { PoolsStoreData } from './stores/poolsStore';
import { addQ96, bytesToQ96, divQ96, invQ96, mulQ96, roundDownQ96 } from './utils/q96';
import { DexGlobalStore, DexGlobalStoreData } from './stores/dexGlobalStore';
import { PositionsStore, PositionsStoreData } from './stores/positionsStore';
import { PriceTicksStoreData, tickToBytes } from './stores/priceTicksStore';
import { uint32beInv } from './utils/bigEndian';


export class DexEndpoint extends BaseEndpoint {
	public async getAllPoolIDs(
		methodContext: MethodContext,
		poolStore: PoolsStore,
	): Promise<PoolID[]> {
		const poolIds: PoolID[] = [];
		const allPoolIds = await poolStore.getAll(methodContext);
		if (allPoolIds && allPoolIds.length) {
			allPoolIds.forEach(poolId => {
				poolIds.push(poolId.key);
			});
		}
		return poolIds;
	}

	public async getAllTokenIDs(
		methodContext: MethodContext,
		stores: NamedRegistry,
	): Promise<Set<TokenID>> {
		const tokens = new Set<TokenID>();
		const allPoolIds = await this.getAllPoolIDs(methodContext, stores.get(PoolsStore));

		if (allPoolIds != null && allPoolIds.length > 0) {
			allPoolIds.forEach(poolID => {
				tokens.add(getToken0Id(poolID));
				tokens.add(getToken1Id(poolID));
			});
		}

		return tokens;
	}

	public getAllPositionIDsInPool(poolId: PoolID, positionIdsList: PositionID[]): Buffer[] {
		const result: Buffer[] = [];
		positionIdsList.forEach(positionId => {
			if (getPoolIDFromPositionID(positionId).equals(poolId)) {
				result.push(positionId);
			}
		});
		return result;
	}

	public async getPool(
		methodContext,
		stores: NamedRegistry,
		poolID: PoolID,
	): Promise<PoolsStoreData> {
		const poolsStore = stores.get(PoolsStore);
		const poolStoreData = await poolsStore.getKey(methodContext, [poolID]);
		return poolStoreData;
	}

	public async getCurrentSqrtPrice(
		methodContext: MethodContext,
		stores: NamedRegistry,
		poolID: PoolID,
		priceDirection: boolean,
	): Promise<Q96> {
		const pools = await this.getPool(methodContext, stores, poolID);
		if (pools == null) {
			throw new Error();
		}
		const q96SqrtPrice = bytesToQ96(pools.sqrtPrice);
		if (priceDirection) {
			return q96SqrtPrice;
		}
		return invQ96(q96SqrtPrice);
	}

	public async getDexGlobalData(
		methodContext: MethodContext,
		stores: NamedRegistry,
	): Promise<DexGlobalStoreData> {
		const dexGlobalStore = stores.get(DexGlobalStore);
		return dexGlobalStore.get(methodContext, Buffer.from([]));
	}

	public async getPosition(
		methodContext: MethodContext,
		stores: NamedRegistry,
		positionID: PositionID,
		positionIdsList: PositionID[],
	): Promise<PositionsStoreData> {
		if (positionIdsList.includes(positionID)) {
			throw new Error();
		}
		const positionsStore = stores.get(PositionsStore);
		const positionStoreData = await positionsStore.get(methodContext, positionID);
		return positionStoreData;
	}

	public async getTickWithTickId(
		methodContext: MethodContext,
		stores: NamedRegistry,
		tickId: TickID[],
	): Promise<PriceTicksStoreData> {
		const priceTicksStore = stores.get(PriceTicksStore);
		const priceTicksStoreData = await priceTicksStore.getKey(methodContext, tickId);
		if (priceTicksStoreData == null) {
			throw new Error('No tick with the specified poolId');
		} else {
			return priceTicksStoreData;
		}
	}

	public async getTickWithPoolIdAndTickValue(
		methodContext: MethodContext,
		stores: NamedRegistry,
		poolId: PoolID,
		tickValue: number,
	): Promise<PriceTicksStoreData> {
		const priceTicksStore = stores.get(PriceTicksStore);
		const key = poolId.toLocaleString() + tickToBytes(tickValue).toLocaleString();
		const priceTicksStoreData = await priceTicksStore.get(methodContext, Buffer.from(key, 'hex'));
		if (priceTicksStoreData == null) {
			throw new Error('No tick with the specified poolId and tickValue');
		} else {
			return priceTicksStoreData;
		}      
	}

	public async getToken1Amount(
        tokenMethod: TokenMethod,
        methodContext: MethodContext,
        poolId: PoolID,
    ): Promise<bigint>{
        const address = poolIdToAddress(poolId);
        const tokenId = getToken1Id(poolId);
        return tokenMethod.getLockedAmount(methodContext, address, tokenId, MODULE_ID_DEX.toString());
    };
	
	public async getToken0Amount (
        tokenMethod: TokenMethod,
        methodContext: MethodContext,
        poolId: PoolID,
    ): Promise<bigint>{
        const address = poolIdToAddress(poolId);
        const tokenId = getToken0Id(poolId);
        return tokenMethod.getLockedAmount(methodContext, address, tokenId, MODULE_ID_DEX.toString());
    };

    public getFeeTier (poolId: PoolID): number {
        const _buffer: Buffer = poolId.slice(-4);
        const _hexBuffer: string = _buffer.toString('hex');
    
        return uint32beInv(_hexBuffer);
    };

    public getPoolIDFromTickID(tickID: Buffer) { return tickID.slice(0, NUM_BYTES_POOL_ID) }

    public getPositionIndex(positionId: PositionID): number{
        const _buffer: Buffer = positionId.slice(-(2 * (NUM_BYTES_POSITION_ID-NUM_BYTES_ADDRESS)));
        const _hexBuffer: string = _buffer.toString('hex');   
        return uint32beInv(_hexBuffer);
    };

	export const getTVL = async (
		tokenMethod: TokenMethod,
		methodContext: MethodContext,
		stores: NamedRegistry,
		poolId: PoolID,
	): Promise<bigint> => {
		const pool = await this.getPool(methodContext, stores, poolId);
		const token1Amount = await this.getToken1Amount(tokenMethod, methodContext, poolId);
		const token0Amount = await this.getToken0Amount(tokenMethod, methodContext, poolId);
		const token0Id = getToken0Id(poolId);
		const token1Id = getToken1Id(poolId);
	
		if (getToken0Id(poolId).equals(TOKEN_ID_LSK)) {
			const token1ValueQ96 = divQ96(
				divQ96(BigInt(token1Amount), bytesToQ96(pool.sqrtPrice)),
				bytesToQ96(pool.sqrtPrice),
			);
			return (
				roundDownQ96(token1ValueQ96) + (await this.getToken0Amount(tokenMethod, methodContext, poolId))
			);
		}
		if (getToken1Id(poolId).equals(TOKEN_ID_LSK)) {
			const token0ValueQ96 = mulQ96(
				mulQ96(BigInt(token0Amount), bytesToQ96(pool.sqrtPrice)),
				bytesToQ96(pool.sqrtPrice),
			);
			return (
				roundDownQ96(token0ValueQ96) + (await this.getToken1Amount(tokenMethod, methodContext, poolId))
			);
		}
	
		const value0Q96 = mulQ96(
			await getLSKPrice(tokenMethod, methodContext, stores, token0Id),
			BigInt(token0Amount),
		);
		const value1Q96 = mulQ96(
			await getLSKPrice(tokenMethod, methodContext, stores, token1Id),
			BigInt(token1Amount),
		);
		return roundDownQ96(addQ96(value0Q96, value1Q96));
	};
}
