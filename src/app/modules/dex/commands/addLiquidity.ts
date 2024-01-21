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
} from 'lisk-sdk';
import { validator } from '@liskhq/lisk-validator';

import { COMMAND_ID_ADD_LIQUIDITY } from '../constants';
import { AmountBelowMinEvent, PositionUpdatedEvent } from '../events';

import { addLiquiditySchema } from '../schemas';
import { PoolsStore, PositionsStore } from '../stores';
import { AddLiquidityParamsData } from '../types';
import {
	checkPositionExistenceAndOwnership,
	getLiquidityForAmounts,
	getPoolIDFromPositionID,
	getToken0Id,
	getToken1Id,
	updatePosition,
} from '../utils/auxiliaryFunctions';
import { tickToPrice } from '../utils/math';
import { q96ToInt, bytesToQ96 } from '../utils/q96';

export class AddLiquidityCommand extends BaseCommand {
	public id = COMMAND_ID_ADD_LIQUIDITY;
	public schema = addLiquiditySchema;
	private _tokenMethod!: TokenMethod;

	public init({ tokenMethod }): void {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		this._tokenMethod = tokenMethod;
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	public async verify(
		ctx: CommandVerifyContext<AddLiquidityParamsData>,
	): Promise<VerificationResult> {
		try {
			validator.validate(addLiquiditySchema, ctx.params);
		} catch (err) {
			return {
				status: VerifyStatus.FAIL,
				error: err as Error,
			};
		}

		const { amount0Min, amount0Desired, amount1Min, amount1Desired } = ctx.params;

		if (ctx.header.timestamp > ctx.params.maxTimestampValid) {
			return {
				status: VerifyStatus.FAIL,
				error: new Error(
					`Current timestamp is over maxTimestampValid: ${ctx.params.maxTimestampValid}`,
				),
			};
		}

		if (amount0Min > amount0Desired || amount1Min > amount1Desired) {
			return {
				status: VerifyStatus.FAIL,
				error: new Error('Please specify valid amounts'),
			};
		}

		return {
			status: VerifyStatus.OK,
		};
	}

	public async execute(ctx: CommandExecuteContext<AddLiquidityParamsData>): Promise<void> {
		const { senderAddress } = ctx.transaction;
		const { positionID, amount0Desired, amount1Desired, amount0Min, amount1Min } = ctx.params;
		const methodContext = ctx.getMethodContext();

		await checkPositionExistenceAndOwnership(
			this.stores,
			this.events,
			methodContext,
			senderAddress,
			positionID,
		);

		const poolID = getPoolIDFromPositionID(positionID);
		const poolsStore = this.stores.get(PoolsStore);
		const positionsStore = this.stores.get(PositionsStore);
		const pool = await poolsStore.get(methodContext, poolID);
		const currentSqrtPrice = pool.sqrtPrice;
		const positionInfo = await positionsStore.get(methodContext, positionID);

		const tickLowerSqrtPrice = tickToPrice(positionInfo.tickLower);
		const tickUpperSqrtPrice = tickToPrice(positionInfo.tickUpper);

		const tokenID0 = getToken0Id(poolID);
		const tokenID1 = getToken1Id(poolID);

		const liquidity = getLiquidityForAmounts(
			q96ToInt(bytesToQ96(currentSqrtPrice)),
			tickLowerSqrtPrice,
			tickUpperSqrtPrice,
			amount0Desired,
			amount1Desired,
		);
		const [amount0, amount1] = await updatePosition(
			methodContext,
			this.events,
			this.stores,
			this._tokenMethod,
			positionID,
			liquidity,
		);

		if (amount0 < amount0Min || amount1 < amount1Min) {
			this.events.get(AmountBelowMinEvent).add(
				methodContext,
				{
					senderAddress,
					amount0,
					amount0Min,
					tokenID0,
					amount1,
					amount1Min,
					tokenID1,
				},
				[senderAddress],
				true,
			);
			throw new Error();
		}

		if (amount0 > amount0Desired || amount1 > amount1Desired) {
			throw new Error();
		}

		this.events.get(PositionUpdatedEvent).add(
			methodContext,
			{
				senderAddress,
				positionID,
				amount0,
				tokenID0,
				amount1,
				tokenID1,
			},
			[senderAddress, positionID],
		);
	}
}
