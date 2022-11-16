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

import { JSONObject } from 'lisk-sdk';

export interface FeeTiers {
	[id: number]: number;
}

export type Q96 = bigint;
export type TokenID = Buffer;
export type PoolID = Buffer;
export type PositionID = Buffer;
export type Address = Buffer;

export interface DexStoreData {
	legacyAddress: string;
	balance: bigint;
}

export interface CreatePoolParamsData {
	tokenID0: Buffer;
	tokenID1: Buffer;
	feeTier: number;
	tickInitialPrice: number;
	initialPosition: {
		tickLower: number;
		tickUpper: number;
		amount0Desired: bigint;
		amount1Desired: bigint;
	};
	maxTimestampValid: bigint;
}

export interface CreatePositionParamsData {
	poolID: Buffer;
	tickLower: number;
	tickUpper: number;
	amount0Desired: bigint;
	amount1Desired: bigint;
	amount0Min: bigint;
	amount1Min: bigint;
	maxTimestampValid: bigint;
}

export type TokenIDReclaim = Buffer;

export interface ModuleConfig {
	feeTiers: [
		{
			feeTier: number;
		},
	];
}

export type ModuleConfigJSON = JSONObject<ModuleConfig>;

export interface ModuleInitArgs {
	moduleConfig: Record<string, unknown>;
}

export type SqrtPrice = Q96;
