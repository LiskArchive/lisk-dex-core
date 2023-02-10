/* eslint-disable import/no-cycle */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable no-param-reassign */

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

import { BaseEndpoint, TokenMethod } from 'lisk-sdk';
import { validator } from '@liskhq/lisk-validator';
import {
	MODULE_ID_DEX,
	NUM_BYTES_POOL_ID,
	TOKEN_ID_LSK,
	NUM_BYTES_ADDRESS,
	NUM_BYTES_POSITION_ID,
} from './constants';
import { PoolsStore } from './stores';
import { PoolID, PositionID, Q96, TickID, TokenID } from './types';
// eslint-disable-next-line import/no-cycle
import {
	computeExceptionalRoute,
	computeRegularRoute,
	getCredibleDirectPrice,
	getPoolIDFromPositionID,
	getToken0Id,
	getToken1Id,
	poolIdToAddress,
	computeCollectableFees,
	computeCollectableIncentives,
} from './utils/auxiliaryFunctions';
import { PoolsStoreData } from './stores/poolsStore';

import {
	getAllPositionIDsInPoolRequestSchema,
	getPoolRequestSchema,
	getAllTickIDsInPoolRequestSchema,
	getLSKPriceRequestSchema,
	getTVLRequestSchema,
	getPositionIndexRequestSchema,
	getPoolIDFromTickIDRequestSchema,
	getFeeTierRequestSchema,
	getToken0AmountRequestSchema,
	getToken1AmountRequestSchema,
	getTickWithPoolIdAndTickValueRequestSchema,
	getTickWithTickIdRequestSchema,
	getPositionRequestSchema,
	getCurrentSqrtPriceRequestSchema,
	getCollectableFeesAndIncentivesRequestSchema,
} from './schemas';

import { addQ96, bytesToQ96, divQ96, invQ96, roundDownQ96, mulQ96 } from './utils/q96';
import { DexGlobalStore, DexGlobalStoreData } from './stores/dexGlobalStore';
import { PositionsStore, PositionsStoreData } from './stores/positionsStore';
import { PriceTicksStore, PriceTicksStoreData, tickToBytes } from './stores/priceTicksStore';
import { uint32beInv } from './utils/bigEndian';

export class DexEndpoint extends BaseEndpoint {
	public async getAllPoolIDs(methodContext): Promise<PoolID[]> {
		const poolStore = this.stores.get(PoolsStore);
		const store = await poolStore.getAll(methodContext);
		const poolIds: PoolID[] = [];
		// eslint-disable-next-line @typescript-eslint/prefer-optional-chain
		if (store && store.length) {
			store.forEach(poolID => {
				poolIds.push(poolID.key);
			});
		}
		return poolIds;
	}

	public async getAllTokenIDs(methodContext): Promise<Set<TokenID>> {
		const tokens = new Set<TokenID>();
		const allPoolIds = await this.getAllPoolIDs(methodContext);
		if (allPoolIds != null && allPoolIds.length > 0) {
			allPoolIds.forEach(poolID => {
				tokens.add(getToken0Id(poolID));
				tokens.add(getToken1Id(poolID));
			});
		}
		return tokens;
	}

	public getAllPositionIDsInPool(methodContext): Buffer[] {
		validator.validate<{ poolID: Buffer; positionIDsList: PositionID[] }>(
			getAllPositionIDsInPoolRequestSchema,
			methodContext.params,
		);
		const result: Buffer[] = [];
		const { poolID, positionIDsList } = methodContext.params;
		positionIDsList.forEach(positionId => {
			if (getPoolIDFromPositionID(positionId).equals(poolID)) {
				result.push(positionId);
			}
		});
		return result;
	}

	public async getCurrentSqrtPrice(methodContext): Promise<Q96> {
		validator.validate<{ poolID: Buffer; priceDirection: false }>(
			getCurrentSqrtPriceRequestSchema,
			methodContext.params,
		);
		const pools = await this.getPool(methodContext);
		if (pools == null) {
			throw new Error();
		}
		const q96SqrtPrice = bytesToQ96(pools.sqrtPrice);
		if (methodContext.params.priceDirection) {
			return q96SqrtPrice;
		}
		return invQ96(q96SqrtPrice);
	}

	public async getDexGlobalData(methodContext): Promise<DexGlobalStoreData> {
		const dexGlobalStore = this.stores.get(DexGlobalStore);
		return dexGlobalStore.get(methodContext, Buffer.from([]));
	}

	public async getPosition(methodContext): Promise<PositionsStoreData> {
		validator.validate<{ positionID: Buffer; positionIDsList: PositionID[] }>(
			getPositionRequestSchema,
			methodContext.params,
		);
		if (methodContext.params.positionIDsList.includes(methodContext.params.positionID)) {
			throw new Error();
		}
		const positionsStore = this.stores.get(PositionsStore);
		const positionStoreData = await positionsStore.get(
			methodContext,
			methodContext.params.positionID,
		);
		return positionStoreData;
	}

	public async getTickWithTickId(methodContext): Promise<PriceTicksStoreData> {
		validator.validate<{ tickIDs: Buffer }>(getTickWithTickIdRequestSchema, methodContext.params);
		const priceTicksStore = this.stores.get(PriceTicksStore);
		const priceTicksStoreData = await priceTicksStore.getKey(methodContext, [
			methodContext.params.tickIDs,
		]);
		if (priceTicksStoreData == null) {
			throw new Error('No tick with the specified poolId');
		} else {
			return priceTicksStoreData;
		}
	}
	public async getTickWithPoolIdAndTickValue(methodContext): Promise<PriceTicksStoreData> {
		validator.validate<{ poolID: Buffer; tickValue: number }>(
			getTickWithPoolIdAndTickValueRequestSchema,
			methodContext.params,
		);
		const priceTicksStore = this.stores.get(PriceTicksStore);
		const key = Buffer.concat([
			methodContext.params.poolID,
			tickToBytes(methodContext.params.tickValue),
		]);
		const priceTicksStoreData = await priceTicksStore.get(methodContext, key);
		if (priceTicksStoreData == null) {
			throw new Error('No tick with the specified poolId and tickValue');
		} else {
			return priceTicksStoreData;
		}
	}

	public async getToken1Amount(tokenMethod: TokenMethod, methodContext): Promise<bigint> {
		validator.validate<{ poolID: Buffer }>(getToken1AmountRequestSchema, methodContext.params);
		const address = poolIdToAddress(methodContext.params.poolID);
		const tokenId = getToken1Id(methodContext.params.poolID);
		return tokenMethod.getLockedAmount(methodContext, address, tokenId, MODULE_ID_DEX.toString());
	}

	public async getToken0Amount(tokenMethod: TokenMethod, methodContext): Promise<bigint> {
		validator.validate<{ poolID: Buffer }>(getToken0AmountRequestSchema, methodContext.params);
		const address = poolIdToAddress(methodContext.params.poolID);
		const tokenId = getToken0Id(methodContext.params.poolID);
		return tokenMethod.getLockedAmount(methodContext, address, tokenId, MODULE_ID_DEX.toString());
	}

	public getFeeTier(methodContext): number {
		validator.validate<{ poolID: Buffer }>(getFeeTierRequestSchema, methodContext.params);
		const _buffer: Buffer = methodContext.params.poolID.slice(-4);
		const _hexBuffer: string = _buffer.toString('hex');

		return uint32beInv(_hexBuffer);
	}

	public getPoolIDFromTickID(methodContext): Buffer {
		validator.validate<{ tickID: Buffer }>(getPoolIDFromTickIDRequestSchema, methodContext.params);
		const { tickID } = methodContext.params;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return tickID.slice(0, NUM_BYTES_POOL_ID);
	}

	public getPositionIndex(methodContext): number {
		validator.validate<{ positionID: Buffer }>(getPositionIndexRequestSchema, methodContext.params);
		const { positionID } = methodContext.params;
		const _buffer: Buffer = positionID.slice(-(2 * (NUM_BYTES_POSITION_ID - NUM_BYTES_ADDRESS)));
		const _hexBuffer: string = _buffer.toString('hex');
		return uint32beInv(_hexBuffer);
	}

	public async getTVL(tokenMethod: TokenMethod, methodContext): Promise<bigint> {
		validator.validate<{ poolID: Buffer; token0ID: Buffer; token1ID: Buffer }>(
			getTVLRequestSchema,
			methodContext.params,
		);
		const { poolID } = methodContext.params;
		const pool = await this.getPool(methodContext);
		const token1Amount = await this.getToken1Amount(tokenMethod, methodContext);
		const token0Amount = await this.getToken0Amount(tokenMethod, methodContext);

		if (getToken0Id(poolID).equals(TOKEN_ID_LSK)) {
			const token1ValueQ96 = divQ96(
				divQ96(BigInt(token1Amount), bytesToQ96(pool.sqrtPrice)),
				bytesToQ96(pool.sqrtPrice),
			);
			return (
				roundDownQ96(token1ValueQ96) + (await this.getToken0Amount(tokenMethod, methodContext))
			);
		}
		if (getToken1Id(poolID).equals(TOKEN_ID_LSK)) {
			const token0ValueQ96 = mulQ96(
				mulQ96(BigInt(token0Amount), bytesToQ96(pool.sqrtPrice)),
				bytesToQ96(pool.sqrtPrice),
			);
			return (
				roundDownQ96(token0ValueQ96) + (await this.getToken1Amount(tokenMethod, methodContext))
			);
		}

		const value0Q96 = mulQ96(
			await this.getLSKPrice(tokenMethod, methodContext),
			BigInt(token0Amount),
		);
		const value1Q96 = mulQ96(
			await this.getLSKPrice(tokenMethod, methodContext),
			BigInt(token1Amount),
		);
		return roundDownQ96(addQ96(value0Q96, value1Q96));
	}

	public async getLSKPrice(tokenMethod: TokenMethod, methodContext): Promise<bigint> {
		validator.validate<{ tokenID: Buffer; poolID: Buffer }>(
			getLSKPriceRequestSchema,
			methodContext.params,
		);
		const { tokenID } = methodContext.params;
		let tokenRoute = await computeRegularRoute(methodContext, this.stores, tokenID, TOKEN_ID_LSK);
		let price = BigInt(1);

		if (tokenRoute.length === 0) {
			tokenRoute = await computeExceptionalRoute(methodContext, this.stores, tokenID, TOKEN_ID_LSK);
		}
		if (tokenRoute.length === 0) {
			throw new Error('No swap route between LSK and the given token');
		}

		let tokenIn = tokenRoute[0];

		for (const rt of tokenRoute) {
			const credibleDirectPrice = await getCredibleDirectPrice(
				tokenMethod,
				methodContext,
				this.stores,
				tokenIn,
				rt,
			);

			const tokenIDArrays = [tokenIn, rt];
			// eslint-disable-next-line @typescript-eslint/require-array-sort-compare
			const [tokenID0, tokenID1] = tokenIDArrays.sort();

			if (tokenIn.equals(tokenID0) && rt.equals(tokenID1)) {
				price = mulQ96(BigInt(1), credibleDirectPrice);
			} else if (tokenIn.equals(tokenID1) && rt.equals(tokenID0)) {
				price = divQ96(BigInt(1), credibleDirectPrice);
			}
			tokenIn = rt;
		}
		return price;
	}

	public async getAllTicks(methodContext): Promise<TickID[]> {
		const tickIds: Buffer[] = [];
		const priceTicksStore = this.stores.get(PriceTicksStore);
		const allTickIds = await priceTicksStore.getAll(methodContext);
		allTickIds.forEach(tickId => {
			tickIds.push(tickId.key);
		});
		return tickIds;
	}

	public async getAllTickIDsInPool(methodContext): Promise<TickID[]> {
		validator.validate<{ poolID: Buffer }>(getAllTickIDsInPoolRequestSchema, methodContext.params);
		const { poolID } = methodContext.params;
		const result: Buffer[] = [];
		const allTicks = await this.getAllTicks(methodContext);
		allTicks.forEach(tickID => {
			if (this.getPoolIDFromTickID(methodContext).equals(poolID)) {
				result.push(tickID);
			}
		});
		return result;
	}

	public async getPool(methodContext): Promise<PoolsStoreData> {
		validator.validate<{ poolID: Buffer }>(getPoolRequestSchema, methodContext.params);
		const poolsStore = this.stores.get(PoolsStore);
		const key = await poolsStore.getKey(methodContext, [methodContext.params.poolID]);
		return key;
	}

	public async getCollectableFeesAndIncentives(methodContext, tokenMethod: TokenMethod) {
		validator.validate<{ positionID: Buffer }>(
			getCollectableFeesAndIncentivesRequestSchema,
			methodContext.params,
		);

		const positionId = Buffer.from(methodContext.params.positionID, 'hex');
		const positionsStore = this.stores.get(PositionsStore);
		const hasPositionData = await positionsStore.has(methodContext, positionId);

		if (!hasPositionData) {
			throw new Error('The position is not registered!');
		}

		const [collectableFees0, collectableFees1] = await computeCollectableFees(
			this.stores,
			methodContext,
			positionId,
		);

		const dexGlobalStore = this.stores.get(DexGlobalStore);
		const [collectableIncentives] = await computeCollectableIncentives(
			dexGlobalStore,
			tokenMethod,
			methodContext,
			positionId,
			collectableFees0,
			collectableFees1,
		);
		return [collectableFees0, collectableFees1, collectableIncentives];
	}
}
