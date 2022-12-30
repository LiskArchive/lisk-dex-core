/*
 * Copyright © 2021 Lisk Foundation
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
    SwapFailedReasons
} from '../constants';
import { swapWithPriceLimitCommandSchema } from '../schemas';
import { swapWithPriceLimitParamsData } from '../types';
import {
	computeCurrentPrice,
	getPool,
	getToken0Id,
	getToken1Id,
	swap,
	transferFeesFromPool,
	transferFromPool,
	transferToPool,
} from '../utils/auxiliaryFunctions';
import { SwapFailedEvent } from '../events/swapFailed';
import { SwappedEvent } from '../events/swapped';
import { bytesToQ96, q96ToBytes } from '../utils/q96';

export class SwapExactWithPriceLimitCommand extends BaseCommand {
	public id = COMMAND_ID_SWAP_WITH_PRICE_LIMIT;
	public schema = swapWithPriceLimitCommandSchema;
	private _tokenMethod!: TokenMethod;

	public init({ tokenMethod }): void {
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
		const pool = await getPool(methodContext, this.stores, poolId);
		if (pool == null) {
			return {
				status: VerifyStatus.FAIL,
				error: new Error('A pool does not exist with specified poolId'),
			};
		}

		if (getToken0Id(poolId) !== tokenIdIn && getToken1Id(poolId) !== tokenIdIn) {
			return {
				status: VerifyStatus.FAIL,
				error: new Error('TokenIds from poolId are not equal to tokenIds'),
			};
		}

		if (getToken0Id(poolId) !== tokenIdOut && getToken1Id(poolId) !== tokenIdOut) {
			return {
				status: VerifyStatus.FAIL,
				error: new Error('TokenIds from poolId are not equal to tokenIds'),
			};
		}

		/*
        TODO: Not yet implemented on SDK
        if (maxTimestampValid < lastBlockheader.timestamp){
            return {
				status: VerifyStatus.FAIL,
				error: new Error('maxTimestampValid is less than lastBlockheader.timestamp'),
			};
        }
        */

		return {
			status: VerifyStatus.OK,
		};
	}

	public async execute(ctx: CommandExecuteContext<swapWithPriceLimitParamsData>): Promise<void> {
		const senderAddress = ctx.transaction.senderPublicKey.slice(0, NUM_BYTES_ADDRESS);
		const {
			tokenIdIn,
			maxAmountTokenIn,
			tokenIdOut,
			minAmountTokenOut,
			poolId,
			sqrtLimitPrice,
		} = ctx.params;
		const methodContext = ctx.getMethodContext();

		let priceBefore: bigint;
		let zeroToOne;
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
					reason: SwapFailedReasons.SWAPFAILEDINVALIDROUTE,
				},
				[senderAddress],
				true,
			);
			throw new Error();
		}

		if (
			bytesToQ96(sqrtLimitPrice) < MIN_SQRT_RATIO ||
			bytesToQ96(sqrtLimitPrice) > MAX_SQRT_RATIO
		) {
			this.events.get(SwapFailedEvent).add(
				methodContext,
				{
					senderAddress,
					tokenIdIn,
					tokenIdOut,
					reason: SwapFailedReasons.SWAPFAILEDINVALIDLIMITPRICE,
				},
				[senderAddress],
				true,
			);
			throw new Error();
		}

		if (getToken0Id(poolId) === tokenIdIn) {
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
				bytesToQ96(sqrtLimitPrice),
				maxAmountTokenIn,
				true,
				currentHeight,
				tokenIdIn,
				tokenIdOut,
			);
			if (amountOut < minAmountTokenOut) {
				this.events.get(SwapFailedEvent).add(
					methodContext,
					{
						senderAddress,
						tokenIdIn,
						tokenIdOut,
						reason: SwapFailedReasons.SWAPFAILEDNOTENOUGH,
					},
					[senderAddress],
					true,
				);
				throw new Error();
			}

			const priceAfter = await computeCurrentPrice(
				methodContext,
				this.stores,
				tokenIdIn,
				tokenIdOut,
				[poolId],
			);
			transferToPool(this._tokenMethod, methodContext, senderAddress, poolId, tokenIdIn, amountIn).catch((err: string | undefined)=>{
              throw new Error(err)
            });
			transferFeesFromPool(this._tokenMethod, methodContext, Number(feesIn), tokenIdIn, poolId);
			transferFromPool(
				this._tokenMethod,
				methodContext,
				poolId,
				senderAddress,
				tokenIdOut,
				amountOut,
			).catch((err: string | undefined)=>{
                throw new Error(err)
              });;
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
					amountOut
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
					reason: SwapFailedReasons.SWAPFAILEDTOOMANYTICKS,
				},
				[senderAddress],
				true,
			);
			throw new Error();
		}
	}
}