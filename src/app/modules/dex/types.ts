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

export interface FeeTiers {
	[id: number]: number;
}

export type Q96 = BigInt;
export type TokenID = Buffer;
export type PoolID = Buffer;
export type PositionID = Buffer;
export type Address = Buffer;