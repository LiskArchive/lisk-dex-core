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

import { ImmutableMethodContext } from 'lisk-sdk';
import { ImmutableSubStore } from '../types/types';

interface ImmutableSubStoreGetter {
	getStore: (moduleID: Buffer, storePrefix: Buffer) => ImmutableSubStore;
}

export const createImmutableMethodContext = (
	immutableSubstoreGetter: ImmutableSubStoreGetter,
): ImmutableMethodContext => ({
	getStore: (moduleID: Buffer, storePrefix: Buffer) =>
		immutableSubstoreGetter.getStore(moduleID, storePrefix),
});
