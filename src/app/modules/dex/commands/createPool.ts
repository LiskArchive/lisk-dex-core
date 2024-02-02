/*
 * Copyright © 2024 Lisk Foundation
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

import {
	BaseCommand,
	CommandExecuteContext,
	CommandVerifyContext,
	VerificationResult,
	VerifyStatus,
	TokenMethod,
	FeeMethod,
} from 'lisk-sdk';
import { validator } from '@liskhq/lisk-validator';

import {
	MAX_TICK,
	MIN_TICK,
	POOL_CREATION_FEE,
	POOL_CREATION_SUCCESS,
	POSITION_CREATION_SUCCESS,
} from '../constants';
import { AmountBelowMinEvent, PoolCreatedEvent, PoolCreationFailedEvent } from '../events';
import { PositionCreatedEvent } from '../events/positionCreated';
import { PositionCreationFailedEvent } from '../events/positionCreationFailed';

import { createPoolSchema } from '../schemas';
import { PoolsStore } from '../stores';
import { CreatePoolParamsData, ModuleConfig, TokenID } from '../types';
import {
	createPool,
	createPosition,
	getLiquidityForAmounts,
	updatePosition,
} from '../utils/auxiliaryFunctions';
import { tickToPrice } from '../utils/math';

export const computePoolID = (tokenID0: TokenID, tokenID1: TokenID, feeTier: number): Buffer => {
	const feeTierBuffer = Buffer.alloc(4);
	feeTierBuffer.writeInt8(feeTier, 0);
	return Buffer.concat([tokenID0, tokenID1, feeTierBuffer]);
};
export class CreatePoolCommand extends BaseCommand {
	public schema = createPoolSchema;
	private _moduleConfig!: ModuleConfig;
	private _tokenMethod!: TokenMethod;
	private _feeMethod!: FeeMethod;

	public init({ moduleConfig, tokenMethod, feeMethod }): void {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		this._moduleConfig = moduleConfig;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		this._tokenMethod = tokenMethod;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		this._feeMethod = feeMethod;
	}

	public async verify(
		ctx: CommandVerifyContext<CreatePoolParamsData>,
	): Promise<VerificationResult> {
		try {
			validator.validate(createPoolSchema, ctx.params);
		} catch (err) {
			return {
				status: VerifyStatus.FAIL,
				error: err as Error,
			};
		}

		const { tokenID0, tokenID1, feeTier, tickInitialPrice, initialPosition } = ctx.params;

		if (tokenID0 >= tokenID1) {
			return {
				status: VerifyStatus.FAIL,
				error: new Error('Please sort tokenID0 and tokenID1 lexicographically.'),
			};
		}

		if (
			initialPosition.amount0Desired === BigInt(0) ||
			initialPosition.amount1Desired === BigInt(0)
		) {
			return {
				status: VerifyStatus.FAIL,
				error: new Error('Please specify amount0Desired or amount1Desired.'),
			};
		}

		if (
			MIN_TICK > initialPosition.tickLower ||
			initialPosition.tickLower > tickInitialPrice ||
			tickInitialPrice > initialPosition.tickUpper ||
			initialPosition.tickLower >= initialPosition.tickUpper ||
			initialPosition.tickUpper > MAX_TICK
		) {
			return {
				status: VerifyStatus.FAIL,
				error: new Error('Please specify valid tick values.'),
			};
		}

		if (ctx.header.timestamp > ctx.params.maxTimestampValid) {
			return {
				status: VerifyStatus.FAIL,
				error: new Error('Current timestamp is over maxTimestampValid'),
			};
		}

		const poolId = computePoolID(tokenID0, tokenID1, feeTier);
		const poolStore = this.stores.get(PoolsStore);
		const doesPoolAlreadyExist = await poolStore.has(ctx.getMethodContext(), poolId);

		if (doesPoolAlreadyExist) {
			return {
				status: VerifyStatus.FAIL,
				error: new Error(`Pool ${poolId.readInt32LE(0)} already exists.`),
			};
		}

		return {
			status: VerifyStatus.OK,
		};
	}

	public async execute(ctx: CommandExecuteContext<CreatePoolParamsData>): Promise<void> {
		const { senderAddress } = ctx.transaction;
		const { tokenID0, tokenID1, feeTier, initialPosition } = ctx.params;
		const methodContext = ctx;
		const initialSqrtPrice = tickToPrice(ctx.params.tickInitialPrice);
		const result = await createPool(
			this._moduleConfig,
			methodContext,
			this.stores.get(PoolsStore),
			tokenID0,
			tokenID1,
			feeTier,
			initialSqrtPrice,
			ctx.header.height,
		);

		if (result !== POOL_CREATION_SUCCESS) {
			this.events.get(PoolCreationFailedEvent).add(
				methodContext,
				{
					senderAddress,
					tokenID0,
					tokenID1,
					feeTier,
					result,
				},
				[senderAddress],
				true,
			);
			throw new Error(`Pool creation failed with code ${result}.`);
		}

		const poolID = computePoolID(tokenID0, tokenID1, feeTier);
		this.events.get(PoolCreatedEvent).add(
			methodContext,
			{
				senderAddress,
				poolID,
				tokenID0,
				tokenID1,
				feeTier,
			},
			[senderAddress, poolID],
		);
		const [positionCreationResult, positionID] = await createPosition(
			methodContext,
			this.stores,
			senderAddress,
			poolID,
			initialPosition.tickLower,
			initialPosition.tickUpper,
		);
		if (positionCreationResult !== POSITION_CREATION_SUCCESS) {
			this.events.get(PositionCreationFailedEvent).add(
				methodContext,
				{
					senderAddress,
					poolID,
					tickLower: initialPosition.tickLower,
					tickUpper: initialPosition.tickUpper,
					result,
				},
				[senderAddress],
				true,
			);

			throw new Error(`Position creation failed with code ${positionCreationResult}.`);
		}

		const tickLowerSqrtPrice = tickToPrice(initialPosition.tickLower);
		const tickUpperSqrtPrice = tickToPrice(initialPosition.tickUpper);
		const liquidity = getLiquidityForAmounts(
			initialSqrtPrice,
			tickLowerSqrtPrice,
			tickUpperSqrtPrice,
			initialPosition.amount0Desired,
			initialPosition.amount1Desired,
		);
		const [amount0, amount1] = await updatePosition(
			methodContext,
			this.events,
			this.stores,
			this._tokenMethod,
			positionID,
			liquidity,
		);

		if (amount0 === BigInt(0) || amount1 === BigInt(0)) {
			this.events.get(AmountBelowMinEvent).add(
				methodContext,
				{
					senderAddress,
					amount0,
					amount0Min: BigInt(1),
					tokenID0,
					amount1,
					amount1Min: BigInt(1),
					tokenID1,
				},
				[senderAddress],
				true,
			);
			throw new Error('Please specify a valid value for amount0 and amount1.');
		}

		if (amount0 > initialPosition.amount0Desired || amount1 > initialPosition.amount1Desired) {
			throw new Error('Parameter amountX cannot be larger than amountXDesired.');
		}

		this._feeMethod.payFee(methodContext, POOL_CREATION_FEE);

		this.events.get(PositionCreatedEvent).add(
			methodContext,
			{
				senderAddress,
				positionID,
				tickLower: initialPosition.tickLower,
				tickUpper: initialPosition.tickUpper,
				amount0,
				tokenID0,
				amount1,
				tokenID1,
			},
			[senderAddress, poolID, positionID],
		);
	}
}
