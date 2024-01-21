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
	COMMAND_ID_CREATE_POSITION,
	MAX_TICK,
	MIN_TICK,
	POSITION_CREATION_FEE,
	POSITION_CREATION_SUCCESS,
} from '../constants';
import { AmountBelowMinEvent } from '../events';
import { PositionCreatedEvent } from '../events/positionCreated';
import { PositionCreationFailedEvent } from '../events/positionCreationFailed';

import { createPositionSchema } from '../schemas';
import { PoolsStore } from '../stores';
import { CreatePositionParamsData } from '../types';
import {
	createPosition,
	getLiquidityForAmounts,
	getToken0Id,
	getToken1Id,
	updatePosition,
} from '../utils/auxiliaryFunctions';
import { tickToPrice } from '../utils/math';
import { bytesToQ96, q96ToInt } from '../utils/q96';

export class CreatePositionCommand extends BaseCommand {
	public id = COMMAND_ID_CREATE_POSITION;
	public schema = createPositionSchema;
	private _tokenMethod!: TokenMethod;
	private _feeMethod!: FeeMethod;

	public init({ tokenMethod, feeMethod }): void {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		this._tokenMethod = tokenMethod;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		this._feeMethod = feeMethod;
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	public async verify(
		ctx: CommandVerifyContext<CreatePositionParamsData>,
	): Promise<VerificationResult> {
		try {
			validator.validate(createPositionSchema, ctx.params);
		} catch (err) {
			return {
				status: VerifyStatus.FAIL,
				error: err as Error,
			};
		}

		const { tickLower, tickUpper, amount0Desired, amount1Desired, amount0Min, amount1Min } =
			ctx.params;

		if (MIN_TICK > tickLower || tickLower >= tickUpper || tickUpper > MAX_TICK) {
			return {
				status: VerifyStatus.FAIL,
				error: new Error('Please specify valid tick values'),
			};
		}

		if (amount0Min > amount0Desired || amount1Min > amount1Desired) {
			return {
				status: VerifyStatus.FAIL,
				error: new Error('Please specify valid amounts'),
			};
		}

		if (ctx.header.timestamp > ctx.params.maxTimestampValid) {
			return {
				status: VerifyStatus.FAIL,
				error: new Error('Current timestamp is over maxTimestampValid'),
			};
		}

		return {
			status: VerifyStatus.OK,
		};
	}

	public async execute(ctx: CommandExecuteContext<CreatePositionParamsData>): Promise<void> {
		const { senderAddress } = ctx.transaction;
		const { poolID, tickLower, tickUpper, amount0Desired, amount1Desired, amount0Min, amount1Min } =
			ctx.params;
		const methodContext = ctx.getMethodContext();

		const [positionCreationResult, positionID] = await createPosition(
			methodContext,
			this.stores,
			senderAddress,
			poolID,
			tickLower,
			tickUpper,
		);

		if (positionCreationResult !== POSITION_CREATION_SUCCESS) {
			this.events.get(PositionCreationFailedEvent).add(
				methodContext,
				{
					senderAddress,
					poolID,
					tickLower,
					tickUpper,
					result: positionCreationResult,
				},
				[senderAddress],
				true,
			);
			throw new Error();
		}

		const poolsStore = this.stores.get(PoolsStore);
		const pool = await poolsStore.get(methodContext, poolID);
		const currentSqrtPrice = pool.sqrtPrice;

		const tickLowerSqrtPrice = tickToPrice(tickLower);
		const tickUpperSqrtPrice = tickToPrice(tickUpper);
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

		const tokenID0 = getToken0Id(poolID);
		const tokenID1 = getToken1Id(poolID);

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

		this._feeMethod.payFee(methodContext, POSITION_CREATION_FEE);

		this.events.get(PositionCreatedEvent).add(
			methodContext,
			{
				senderAddress,
				positionID,
				tickLower,
				tickUpper,
				amount0,
				tokenID0,
				amount1,
				tokenID1,
			},
			[senderAddress, poolID, positionID],
		);
	}
}
