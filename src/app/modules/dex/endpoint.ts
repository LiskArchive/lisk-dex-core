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

import { BaseEndpoint, MethodContext } from 'lisk-sdk';
import { NUM_BYTES_ADDRESS, NUM_BYTES_POSITION_ID } from './constants';
import { PoolsStore } from './stores';
import { PoolID, PositionID } from './types';
import { uint32beInv } from './utils/bigEndian';

export class DexEndpoint extends BaseEndpoint {

    public async getAllPoolIDs(	methodContext: MethodContext,
		poolStore: PoolsStore): Promise<PoolID[]>{
			const poolIds: PoolID[] = [];
			const allPoolIds = await poolStore.getAll(methodContext);
			if (allPoolIds && allPoolIds.length){
				allPoolIds.forEach(poolId => {
					poolIds.push(poolId.key);
				});
			}
			return poolIds;
	}

    public getPositionIndex(positionId: PositionID): number{
        const _buffer: Buffer = positionId.slice(-(2 * (NUM_BYTES_POSITION_ID-NUM_BYTES_ADDRESS)));
        const _hexBuffer: string = _buffer.toString('hex');   
        return uint32beInv(_hexBuffer);
    };
}
