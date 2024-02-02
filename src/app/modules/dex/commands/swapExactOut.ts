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
	COMMAND_ID_SWAP_EXACT_OUTPUT,
	MAX_HOPS_SWAP,
	MAX_SQRT_RATIO,
	MIN_SQRT_RATIO,
	NUM_BYTES_ADDRESS,
	SwapFailedReasons,
} from '../constants';
import { swapExactOutCommandSchema } from '../schemas';
import { feesInterface, SwapExactOutParamsData } from '../types';
import {
	getToken0Id,
	getToken1Id,
	transferFromPool,
	transferPoolToPool,
	transferToPool,
} from '../utils/auxiliaryFunctions';
import { SwapFailedEvent } from '../events/swapFailed';
import { SwappedEvent } from '../events/swapped';
import { q96ToBytes } from '../utils/q96';
import { computeCurrentPrice, swap, transferFeesFromPool } from '../utils/swapFunctions';

export class SwapExactOutCommand extends BaseCommand {
	public id = COMMAND_ID_SWAP_EXACT_OUTPUT;
	public schema = swapExactOutCommandSchema;
	private _tokenMethod!: TokenMethod;

	public init({ tokenMethod }): void {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		this._tokenMethod = tokenMethod;
	}
	// eslint-disable-next-line @typescript-eslint/require-await
	public async verify(
		ctx: CommandVerifyContext<SwapExactOutParamsData>,
	): Promise<VerificationResult> {
		try {
			validator.validate(swapExactOutCommandSchema, ctx.params);
		} catch (err) {
			return {
				status: VerifyStatus.FAIL,
				error: err as Error,
			};
		}

		const { tokenIdIn, tokenIdOut, swapRoute } = ctx.params;

		if (tokenIdIn.equals(tokenIdOut)) {
			return {
				status: VerifyStatus.FAIL,
				error: new Error('tokenIdIn and tokenIdOut are same'),
			};
		}

		if (swapRoute === null || swapRoute.length === 0 || swapRoute.length > MAX_HOPS_SWAP) {
			return {
				status: VerifyStatus.FAIL,
				error: new Error(
					'SwapRout is either null or empty or length is greater than MAX_HOPS_SWAP',
				),
			};
		}

		const firstPool = swapRoute[0];
		const lastPool = swapRoute[swapRoute.length - 1];

		if (!getToken0Id(firstPool).equals(tokenIdIn) && !getToken1Id(firstPool).equals(tokenIdIn)) {
			return {
				status: VerifyStatus.FAIL,
				error: new Error('TokenIds from swapRoute are not equal to tokenIds'),
			};
		}

		if (!getToken0Id(lastPool).equals(tokenIdOut) && !getToken1Id(firstPool).equals(tokenIdOut)) {
			return {
				status: VerifyStatus.FAIL,
				error: new Error('TokenIds from swapRoute are not equal to tokenIds'),
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

	public async execute(ctx: CommandExecuteContext<SwapExactOutParamsData>): Promise<void> {
		const senderAddress = ctx.transaction.senderPublicKey.slice(0, NUM_BYTES_ADDRESS);
		const { tokenIdIn, maxAmountTokenIn, tokenIdOut, amountTokenOut, swapRoute } = ctx.params;
		const methodContext = ctx.getMethodContext();
		const inverseSwapRoute = swapRoute.reverse();

		const tokens = [{ id: tokenIdIn, amount: amountTokenOut }];
		const fees: feesInterface[] = [];

		let priceBefore: bigint;
		/* 
						const currentHeight = height of the block containing trs
				*/
		const currentHeight = ctx.header.height;
		try {
			priceBefore = await computeCurrentPrice(
				methodContext,
				this.stores,
				tokenIdIn,
				tokenIdOut,
				swapRoute,
			);
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
		for (const inverseSwapRt of inverseSwapRoute) {
			const currentTokenOut = tokens[tokens.length - 1];
			let zeroToOne = false;
			let IdIn: Buffer;
			if (getToken1Id(inverseSwapRt).equals(currentTokenOut.id)) {
				zeroToOne = true;
				IdIn = getToken0Id(inverseSwapRt);
			} else if (getToken0Id(inverseSwapRt).equals(currentTokenOut.id)) {
				zeroToOne = false;
				IdIn = getToken1Id(inverseSwapRt);
			} else {
				throw new Error('getToken0Id or getToken1Id is not equal to currentTokenIn.id');
			}
			const sqrtLimitPrice = zeroToOne ? MIN_SQRT_RATIO : MAX_SQRT_RATIO;
			try {
				const [amountIn, , feesIn, feesOut] = await swap(
					methodContext,
					this.stores,
					inverseSwapRt,
					zeroToOne,
					sqrtLimitPrice,
					currentTokenOut.amount,
					false,
					currentHeight,
				);
				tokens.push({ id: IdIn, amount: amountIn });
				fees.push({ in: feesIn, out: feesOut });
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

		if (tokens[tokens.length - 1].amount < maxAmountTokenIn) {
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
		} else {
			const priceAfter = await computeCurrentPrice(
				methodContext,
				this.stores,
				tokenIdIn,
				tokenIdOut,
				swapRoute,
			).catch((err: string | undefined) => {
				throw new Error(err);
			});
			transferFromPool(
				this._tokenMethod,
				methodContext,
				inverseSwapRoute[0],
				senderAddress,
				tokenIdOut,
				tokens[0].amount,
			).catch((err: string | undefined) => {
				throw new Error(err);
			});
			transferFeesFromPool(
				this._tokenMethod,
				methodContext,
				Number(fees[0].out),
				tokenIdOut,
				inverseSwapRoute[0],
			);
			for (let i = 1; i < inverseSwapRoute.length; i += 1) {
				transferFeesFromPool(
					this._tokenMethod,
					methodContext,
					Number(fees[i - 1].in),
					tokens[i].id,
					inverseSwapRoute[i - 1],
				);
				transferPoolToPool(
					this._tokenMethod,
					methodContext,
					inverseSwapRoute[i - 1],
					inverseSwapRoute[i],
					tokens[i].id,
					tokens[i].amount,
				).catch((err: string | undefined) => {
					throw new Error(err);
				});
				transferFeesFromPool(
					this._tokenMethod,
					methodContext,
					Number(fees[i].out),
					tokens[i].id,
					inverseSwapRoute[i],
				);
			}
			transferFeesFromPool(
				this._tokenMethod,
				methodContext,
				Number(fees[fees.length - 1].in),
				tokenIdIn,
				inverseSwapRoute[inverseSwapRoute.length - 1],
			);
			transferToPool(
				this._tokenMethod,
				methodContext,
				senderAddress,
				inverseSwapRoute[inverseSwapRoute.length - 1],
				tokenIdIn,
				tokens[tokens.length - 1].amount,
			).catch((err: string | undefined) => {
				throw new Error(err);
			});
			this.events.get(SwappedEvent).add(
				methodContext,
				{
					senderAddress,
					priceBefore: q96ToBytes(priceBefore),
					priceAfter: q96ToBytes(priceAfter),
					tokenIdIn,
					amountIn: tokens[tokens.length - 1].amount,
					tokenIdOut,
					amountOut: amountTokenOut,
				},
				[senderAddress],
			);
		}
	}
}
