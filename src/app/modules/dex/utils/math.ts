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

import { toBufferBE } from 'bigint-buffer';

import {
	MAX_NUM_BYTES_Q96,
	PRICE_VALUE_FOR_BIT_POSITION_IN_Q96,
	MIN_TICK,
	MAX_TICK,
	LOG_MAX_TICK,
} from '../constants';
import { sqrt } from './mathConstants';

import { Q96, SqrtPrice } from '../types';
import {
	invQ96,
	numberToQ96,
	addQ96,
	divQ96,
	mulDivQ96,
	mulDivRoundUpQ96,
	mulQ96,
	q96ToInt,
	q96ToIntRoundUp,
	subQ96,
} from './q96';

export const computeSqrtPrice = (a: Q96): Buffer => {
	const sqrtA = sqrt(a);
	const sqrtAHex: string = sqrtA.toString(16);
	// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
	return toBufferBE(BigInt(sqrtAHex), MAX_NUM_BYTES_Q96);
};

export const tickToPrice = (tickValue: number): Q96 => {
	if (tickValue < MIN_TICK || tickValue > MAX_TICK) {
		throw new Error(`tickValue ${tickValue} is not valid.`);
	}

	const absTick: number = Math.abs(tickValue);
	let sqrtPrice: Q96 = numberToQ96(BigInt(1));

	PRICE_VALUE_FOR_BIT_POSITION_IN_Q96.forEach((e, i) => {
		// eslint-disable-next-line no-bitwise
		if ((absTick >> i) & 1) {
			sqrtPrice = mulQ96(sqrtPrice, e);
		}
	});

	if (tickValue > BigInt(0)) sqrtPrice = invQ96(sqrtPrice);

	return sqrtPrice;
};

export const priceToTick = (sqrtPrice: Q96): number => {
	let invertedPrice = false;
	const sqrtPriceOriginal = sqrtPrice;
	const PRICE_VALUE_FOR_TICK_1 = sqrt(
		divQ96(numberToQ96(BigInt(10001)), numberToQ96(BigInt(10000))) * BigInt(2) ** BigInt(96),
	);
	if (sqrtPrice >= PRICE_VALUE_FOR_TICK_1) {
		// eslint-disable-next-line no-param-reassign
		sqrtPrice = invQ96(sqrtPrice);
		invertedPrice = true;
	}

	let tickValue = 0;
	let tempPrice = numberToQ96(BigInt(1));
	for (let i = LOG_MAX_TICK; i >= 0; i -= 1) {
		const sqrtPriceAtBit = PRICE_VALUE_FOR_BIT_POSITION_IN_Q96[i];
		const newPrice = mulQ96(tempPrice, sqrtPriceAtBit);
		if (sqrtPrice <= newPrice) {
			// eslint-disable-next-line no-bitwise
			tickValue += 1 << i;
			tempPrice = newPrice;
		}
	}

	if (!invertedPrice) {
		tickValue = -tickValue;
	}
	if (tickToPrice(tickValue) > sqrtPriceOriginal) {
		tickValue -= 1;
	}

	return tickValue;
};

export const getAmount0Delta = (
	sqrtPrice1: SqrtPrice,
	sqrtPrice2: SqrtPrice,
	liquidity: bigint,
	roundUp: boolean,
): bigint => {
	if (liquidity === BigInt(0)) {
		throw new Error();
	}

	if (sqrtPrice1 > sqrtPrice2) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, no-param-reassign
		[sqrtPrice1, sqrtPrice2] = [sqrtPrice2, sqrtPrice1];
	}

	const num1 = numberToQ96(liquidity);
	const num2 = subQ96(sqrtPrice2, sqrtPrice1);
	let amount0 = divQ96(mulDivQ96(num1, num2, sqrtPrice2), sqrtPrice1);

	if (!roundUp) {
		amount0 = q96ToInt(amount0);
	} else {
		amount0 = q96ToIntRoundUp(amount0);
	}
	return amount0;
};

export const getAmount1Delta = (
	sqrtPrice1: SqrtPrice,
	sqrtPrice2: SqrtPrice,
	liquidity: bigint,
	roundUp: boolean,
): bigint => {
	if (liquidity === BigInt(0)) {
		throw new Error();
	}

	if (sqrtPrice1 > sqrtPrice2) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, no-param-reassign
		[sqrtPrice1, sqrtPrice2] = [sqrtPrice2, sqrtPrice1];
	}

	const liquidityQ96 = numberToQ96(liquidity);

	let amount1 = mulQ96(liquidityQ96, subQ96(sqrtPrice2, sqrtPrice1));
	if (!roundUp) {
		amount1 = q96ToInt(amount1);
	} else {
		amount1 = q96ToIntRoundUp(amount1);
	}
	return amount1;
};

export const computeNextPrice = (
	sqrtPrice: SqrtPrice,
	liquidity: bigint,
	amount: bigint,
	isToken0: boolean,
	addsAmount: boolean,
): SqrtPrice => {
	if (liquidity === BigInt(0)) {
		throw new Error();
	}

	const liquidityQ96 = numberToQ96(liquidity);
	const amountQ96 = numberToQ96(amount);
	let denom: Q96;
	let nextSqrtPrice: bigint;
	if (isToken0) {
		if (addsAmount) {
			denom = addQ96(mulQ96(amountQ96, sqrtPrice), liquidityQ96);
		} else {
			denom = subQ96(liquidityQ96, mulQ96(amountQ96, sqrtPrice));
		}
		nextSqrtPrice = mulDivRoundUpQ96(liquidityQ96, sqrtPrice, denom);
	} else if (addsAmount) {
		nextSqrtPrice = addQ96(sqrtPrice, divQ96(amountQ96, liquidityQ96));
	} else {
		nextSqrtPrice = subQ96(
			sqrtPrice,
			mulDivRoundUpQ96(amountQ96, numberToQ96(BigInt(1)), liquidityQ96),
		);
	}
	return nextSqrtPrice;
};
