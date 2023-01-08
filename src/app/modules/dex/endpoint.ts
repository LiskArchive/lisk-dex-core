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
import { MODULE_ID_DEX } from './constants';
import { PoolsStore } from './stores';
import { PoolID } from './types';
import { getToken1Id, poolIdToAddress, getToken0Id } from './utils/auxiliaryFunctions';

export class DexEndpoint extends BaseEndpoint {

    public async getAllPoolIDs(methodContext: MethodContext,
        poolStore: PoolsStore): Promise<PoolID[]> {
        const poolIds: PoolID[] = [];
        const allPoolIds = await poolStore.getAll(methodContext);
        if (allPoolIds && allPoolIds.length) {
            allPoolIds.forEach(poolId => {
                poolIds.push(poolId.key);
            });
        }
        return poolIds;
    }

    public async getToken1Amount(
        tokenMethod: TokenMethod,
        methodContext: MethodContext,
        poolId: PoolID,
    ): Promise<bigint> {
        const address = poolIdToAddress(poolId);
        const tokenId = getToken1Id(poolId);
        return tokenMethod.getLockedAmount(methodContext, address, tokenId, MODULE_ID_DEX.toString());
    };

    public async getToken0Amount(
        tokenMethod: TokenMethod,
        methodContext: MethodContext,
        poolId: PoolID,
    ): Promise<bigint> {
        const address = poolIdToAddress(poolId);
        const tokenId = getToken0Id(poolId);
        return tokenMethod.getLockedAmount(methodContext, address, tokenId, MODULE_ID_DEX.toString());
    };
}
