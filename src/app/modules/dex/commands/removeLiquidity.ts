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
	CommandVerifyContext,
	VerificationResult,
	CommandExecuteContext,
	TokenMethod,
	VerifyStatus,
} from 'lisk-sdk';
import { validator } from '@liskhq/lisk-validator';
import { removeLiquiditySchema } from '../schemas';
import {
	checkPositionExistenceAndOwnership,
	getPoolIDFromPositionID,
	getToken0Id,
	getToken1Id,
	updatePosition,
} from '../utils/auxiliaryFunctions';
import { COMMAND_ID_REMOVE_LIQUIDITY } from '../constants';
import { RemoveLiquidityParamsData } from '../types';
import { RemoveLiquidityFailedEvent } from '../events/removeLiquidityFailed';
import { RemoveLiquidityEvent } from '../events/removeLiquidity';

export class RemoveLiquidityCommand extends BaseCommand {
	public id = COMMAND_ID_REMOVE_LIQUIDITY;
	public schema = removeLiquiditySchema;
	private _tokenMethod!: TokenMethod;

	public init({ tokenMethod }): void {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		this._tokenMethod = tokenMethod;
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	public async verify(
		ctx: CommandVerifyContext<RemoveLiquidityParamsData>,
	): Promise<VerificationResult> {
		try {
			validator.validate(removeLiquiditySchema, ctx.params);
		} catch (err) {
			return {
				status: VerifyStatus.FAIL,
				error: err as Error,
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

	public async execute(ctx: CommandExecuteContext<RemoveLiquidityParamsData>): Promise<void> {
		const senderAddress = ctx.transaction.senderPublicKey;

		const { positionID, liquidityToRemove, amount0Min, amount1Min } = ctx.params;

		const methodContext = ctx.getMethodContext();
		await checkPositionExistenceAndOwnership(
			this.stores,
			this.events,
			methodContext,
			senderAddress,
			positionID,
		);
		const [amount0, amount1] = await updatePosition(
			methodContext,
			this.events,
			this.stores,
			this._tokenMethod,
			positionID,
			liquidityToRemove,
		);
		const poolID = getPoolIDFromPositionID(positionID);
		const tokenID0 = getToken0Id(poolID);
		const tokenID1 = getToken1Id(poolID);

		if (amount0 < amount0Min || amount1 < amount1Min) {
			this.events.get(RemoveLiquidityFailedEvent).add(
				methodContext,
				{
					senderAddress,
					amount0,
					amount1,
					amount0Min,
					tokenID0,
					tokenID1,
					amount1Min,
				},
				[senderAddress],
				true,
			);
			throw new Error('Update position amounts are more then minimum amounts');
		}
		this.events.get(RemoveLiquidityEvent).add(
			methodContext,
			{
				senderAddress,
				positionID,
				amount0,
				amount1,
				tokenID0,
				tokenID1,
			},
			[senderAddress, positionID],
			true,
		);
	}
}
