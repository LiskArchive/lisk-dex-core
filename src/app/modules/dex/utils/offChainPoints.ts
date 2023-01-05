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


import {
	PoolsStore,
} from '../stores';

import {
	PoolID,
} from '../types';

export const getAllPoolIDs = async (
	methodContext: MethodContext,
	poolStore: PoolsStore,
): Promise<PoolID[]> => {
	const poolIds: PoolID[] = [];
	const allPoolIds = await poolStore.getAll(methodContext);
	if (allPoolIds != null && allPoolIds.length > 0) {
		allPoolIds.forEach(poolId => {
			poolIds.push(poolId.key);
		});
	}
	return poolIds;
};