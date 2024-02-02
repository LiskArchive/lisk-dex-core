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
import {
	COMMAND_ID_SWAP_WITH_PRICE_LIMIT,
	MAX_SQRT_RATIO,
	MIN_SQRT_RATIO,
	NUM_BYTES_ADDRESS,
	SwapFailedReasons,
} from '../constants';
import { swapWithPriceLimitCommandSchema } from '../schemas';
import { swapWithPriceLimitParamsData } from '../types';
import {
	getToken0Id,
	getToken1Id,
	transferFromPool,
	transferToPool,
} from '../utils/auxiliaryFunctions';
import { SwapFailedEvent } from '../events/swapFailed';
import { SwappedEvent } from '../events/swapped';
import { q96ToBytes } from '../utils/q96';
import { DexModule } from '../module';
import { DexEndpoint } from '../endpoint';
import { computeCurrentPrice, swap, transferFeesFromPool } from '../utils/swapFunctions';

export class SwapExactWithPriceLimitCommand extends BaseCommand {
	public id = COMMAND_ID_SWAP_WITH_PRICE_LIMIT;
	public schema = swapWithPriceLimitCommandSchema;
	private _tokenMethod!: TokenMethod;

	public init({ tokenMethod }): void {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		this._tokenMethod = tokenMethod;
	}
	// eslint-disable-next-line @typescript-eslint/require-await
	public async verify(
		ctx: CommandVerifyContext<swapWithPriceLimitParamsData>,
	): Promise<VerificationResult> {
		try {
			validator.validate(swapWithPriceLimitCommandSchema, ctx.params);
		} catch (err) {
			return {
				status: VerifyStatus.FAIL,
				error: err as Error,
			};
		}

		const { tokenIdIn, tokenIdOut, poolId } = ctx.params;
		const methodContext = ctx.getMethodContext();

		if (tokenIdIn.equals(tokenIdOut)) {
			return {
				status: VerifyStatus.FAIL,
				error: new Error('tokenIdIn and tokenIdOut are same'),
			};
		}
		const dexModule = new DexModule();
		const endpoint = new DexEndpoint(this.stores, dexModule.offchainStores);
		await endpoint.getPool(methodContext, poolId).catch(() => ({
			status: VerifyStatus.FAIL,
			error: new Error('A pool does not exist with specified poolId'),
		}));

		if (!getToken0Id(poolId).equals(tokenIdIn) && !getToken1Id(poolId).equals(tokenIdIn)) {
			return {
				status: VerifyStatus.FAIL,
				error: new Error('TokenIds from poolId are not equal to tokenIds'),
			};
		}

		if (!getToken0Id(poolId).equals(tokenIdOut) && !getToken1Id(poolId).equals(tokenIdOut)) {
			return {
				status: VerifyStatus.FAIL,
				error: new Error('TokenIds from poolId are not equal to tokenIds'),
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

	public async execute(ctx: CommandExecuteContext<swapWithPriceLimitParamsData>): Promise<void> {
		const senderAddress = ctx.transaction.senderPublicKey.slice(0, NUM_BYTES_ADDRESS);
		const { tokenIdIn, maxAmountTokenIn, tokenIdOut, minAmountTokenOut, poolId, sqrtLimitPrice } =
			ctx.params;
		const methodContext = ctx.getMethodContext();

		let priceBefore: bigint;
		let zeroToOne: boolean;
		/* 
						const currentHeight = height of the block containing trs
				*/
		const currentHeight = 0;
		try {
			priceBefore = await computeCurrentPrice(methodContext, this.stores, tokenIdIn, tokenIdOut, [
				poolId,
			]);
		} catch (err) {
			this.events.get(SwapFailedEvent).add(
				methodContext,
				{
					senderAddress,
					tokenIdIn,
					tokenIdOut,
					reason: SwapFailedReasons.SWAP_FAILED_INVALID_ROUTE,
				},
				[senderAddress],
				true,
			);
			throw new Error('SWAP_FAILED_INVALID_ROUTE');
		}

		if (sqrtLimitPrice < MIN_SQRT_RATIO || sqrtLimitPrice > MAX_SQRT_RATIO) {
			this.events.get(SwapFailedEvent).add(
				methodContext,
				{
					senderAddress,
					tokenIdIn,
					tokenIdOut,
					reason: SwapFailedReasons.SWAP_FAILED_INVALID_LIMIT_PRICE,
				},
				[senderAddress],
				true,
			);
			throw new Error('SWAP_FAILED_INVALID_LIMIT_PRICE');
		}

		if (getToken0Id(poolId).equals(tokenIdIn)) {
			zeroToOne = true;
		} else {
			zeroToOne = false;
		}
		try {
			const [amountIn, amountOut, feesIn, feesOut] = await swap(
				methodContext,
				this.stores,
				poolId,
				zeroToOne,
				sqrtLimitPrice,
				maxAmountTokenIn,
				true,
				currentHeight,
			);
			if (amountOut < minAmountTokenOut) {
				this.events.get(SwapFailedEvent).add(
					methodContext,
					{
						senderAddress,
						tokenIdIn,
						tokenIdOut,
						reason: SwapFailedReasons.SWAP_FAILED_NOT_ENOUGH,
					},
					[senderAddress],
					true,
				);
				throw new Error('SWAP_FAILED_NOT_ENOUGH');
			}

			const priceAfter = await computeCurrentPrice(
				methodContext,
				this.stores,
				tokenIdIn,
				tokenIdOut,
				[poolId],
			);
			transferToPool(
				this._tokenMethod,
				methodContext,
				senderAddress,
				poolId,
				tokenIdIn,
				amountIn,
			).catch((err: string | undefined) => {
				throw new Error(err);
			});
			transferFeesFromPool(this._tokenMethod, methodContext, Number(feesIn), tokenIdIn, poolId);
			transferFromPool(
				this._tokenMethod,
				methodContext,
				poolId,
				senderAddress,
				tokenIdOut,
				amountOut,
			).catch((err: string | undefined) => {
				throw new Error(err);
			});
			transferFeesFromPool(this._tokenMethod, methodContext, Number(feesOut), tokenIdOut, poolId);

			this.events.get(SwappedEvent).add(
				methodContext,
				{
					senderAddress,
					priceBefore: q96ToBytes(priceBefore),
					priceAfter: q96ToBytes(priceAfter),
					tokenIdIn,
					amountIn,
					tokenIdOut,
					amountOut,
				},
				[senderAddress],
			);
		} catch (error) {
			this.events.get(SwapFailedEvent).add(
				methodContext,
				{
					senderAddress,
					tokenIdIn,
					tokenIdOut,
					reason: SwapFailedReasons.SWAP_FAILED_TOO_MANY_TICKS,
				},
				[senderAddress],
				true,
			);
			throw new Error('SWAP_FAILED_TOO_MANY_TICKS');
		}
	}
}
