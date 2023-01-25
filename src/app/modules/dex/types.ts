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

import { CCMsg } from 'lisk-framework/dist-node/modules/interoperability/types';
import { ImmutableMethodContext } from 'lisk-framework/dist-node/state_machine';
import { MethodContext } from 'lisk-framework/dist-node/state_machine/method_context';
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

export interface AddLiquidityParamsData {
	positionID: Buffer;
	amount0Desired: bigint;
	amount1Desired: bigint;
	amount0Min: bigint;
	amount1Min: bigint;
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
export interface RemoveLiquidityParamsData {
	positionID: Buffer;
	liquidityToRemove: bigint;
	amount0Min: bigint;
	amount1Min: bigint;
	maxTimestampValid: bigint;
}

export interface CollectFeesParamData {
	positions: Buffer[];
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

export interface InteroperabilityMethod {
	getOwnChainAccount(methodContext: ImmutableMethodContext): Promise<{ id: Buffer }>;
	send(
		methodContext: MethodContext,
		feeAddress: Buffer,
		module: string,
		crossChainCommand: string,
		receivingChainID: Buffer,
		fee: bigint,
		status: number,
		parameters: Buffer,
	): Promise<boolean>;
	error(methodContext: MethodContext, ccm: CCMsg, code: number): Promise<void>;
	terminateChain(methodContext: MethodContext, chainID: Buffer): Promise<void>;
	getChannel(methodContext: MethodContext, chainID: Buffer): Promise<{ messageFeeTokenID: Buffer }>;
}

//Swap Types
export type TickID = Buffer; //TickID for Swap types

//PoolsGraph for Swap types
export type PoolsGraph = {
	vertices: Set<TokenID>;
	edges: Set<PoolID>;
};