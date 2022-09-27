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

import {
    toBufferBE
} from 'bigint-buffer';

import {
    MAX_NUM_BYTES_Q96,
    PRICE_VALUE_FOR_BIT_POSITION_IN_Q96,
    MIN_TICK,
    MAX_TICK,
    LOG_MAX_TICK
} from '../constants';
import {
    sqrt
} from "./mathConstants";

import {
    Q96, SqrtPrice
} from '../types';
import {
    numberToQ96,
    mulQ96,
    invQ96,
    subQ96,
    divQ96,
    mulDivQ96,
    q96ToInt,
    q96ToIntRoundUp,
    addQ96,
    mulDivRoundUpQ96
} from './q96';

const range = (from, to, step) => [...Array(Math.floor((to - from) / step) + 1)].map((_, i) => from + i * step);

export const computeSqrtPrice = (a: bigint): Buffer => {
    const aSqrt = sqrt(a);
    const aSqrtHex: string = aSqrt.toString(16);

    return toBufferBE(BigInt(aSqrtHex), MAX_NUM_BYTES_Q96);
}

export const tickToPrice = (tickValue: number): Q96 => {

    if (tickValue < MIN_TICK || tickValue > MAX_TICK) {
        throw new Error('Invalid tick value')
    }

    const absTick: number = Math.abs(tickValue)
    let sqrtPrice: bigint = numberToQ96(BigInt(1));

    PRICE_VALUE_FOR_BIT_POSITION_IN_Q96.forEach((e, i) => {
        if ((absTick >> i) & 1) {
            sqrtPrice = mulQ96(sqrtPrice, e);
        }
    });

    if (tickValue > 0)
        sqrtPrice = invQ96(sqrtPrice)

    return sqrtPrice
}

export const priceToTick = (sqrtPrice: Q96): number => {
    let invertedPrice = false;
    const sqrtPriceOriginal = sqrtPrice
    if (sqrtPrice >= PRICE_VALUE_FOR_TICK_1) {
        sqrtPrice = invQ96(sqrtPrice)
        invertedPrice = true
    }

    let tickValue = 0
    let tempPrice = numberToQ96(BigInt(1))
    range(LOG_MAX_TICK, -1, -1).forEach(i => {
        const sqrtPriceAtBit = PRICE_VALUE_FOR_BIT_POSITION_IN_Q96[i]
        const newPrice = mulQ96(tempPrice, sqrtPriceAtBit)
        if (sqrtPrice <= newPrice) {
            tickValue += 1 << i
            tempPrice = newPrice
        }
    });

    if (!invertedPrice) {
        tickValue = -tickValue
    }
    if (tickToPrice(tickValue) > sqrtPriceOriginal) {
        tickValue -= 1
    }

    return tickValue
}


export const getAmount0Delta = (
    sqrtPrice1: SqrtPrice,
    sqrtPrice2: SqrtPrice,
    liquidity: bigint,
    roundUp: boolean
): bigint => {
    if (liquidity === BigInt(0)) {
        throw new Error()
    }

    if (sqrtPrice1 > sqrtPrice2) {
        [sqrtPrice1, sqrtPrice2] = [sqrtPrice2, sqrtPrice1]
    }

    const num1 = numberToQ96(liquidity)
    const num2 = subQ96(sqrtPrice2, sqrtPrice1)

    let amount0 = divQ96(mulDivQ96(num1, num2, sqrtPrice2), sqrtPrice1)

    if (!roundUp) {
        amount0 = q96ToInt(amount0)
    } else {
        amount0 = q96ToIntRoundUp(amount0)
    }
    return amount0
}


export const getAmount1Delta = (
    sqrtPrice1: SqrtPrice,
    sqrtPrice2: SqrtPrice,
    liquidity: bigint,
    roundUp: boolean
): bigint => {
    if (liquidity === BigInt(0)) {
        throw new Error()
    }

    if (sqrtPrice1 > sqrtPrice2) {
        [sqrtPrice1, sqrtPrice2] = [sqrtPrice2, sqrtPrice1]
    }

    liquidity = numberToQ96(liquidity)
    let amount1 = mulQ96(liquidity, subQ96(sqrtPrice2, sqrtPrice1))

    if (!roundUp) {
        amount1 = q96ToInt(amount1)
    } else {
        amount1 = q96ToIntRoundUp(amount1)
    }
    return amount1
}


export const computeNextPrice = (
    sqrtPrice: SqrtPrice,
    liquidity: bigint,
    amount: bigint,
    isToken0: boolean,
    addsAmount: boolean
): SqrtPrice => {
    if (liquidity === BigInt(0)) {
        throw new Error()
    }

    liquidity = numberToQ96(liquidity)
    amount = numberToQ96(amount)
    if (isToken0) {
        if (addsAmount) {
            const denom = addQ96(mulQ96(amount, sqrtPrice), liquidity)
        } else {
            const denom = subQ96(liquidity, mulQ96(amount, sqrtPrice))
        }
        const nextSqrtPrice = mulDivRoundUpQ96(liquidity, sqrtPrice, denom)

    } else if (addsAmount) {
            const nextSqrtPrice = addQ96(sqrtPrice, divQ96(amount, liquidity))
        } else {
            const nextSqrtPrice = subQ96(sqrtPrice, mulDivRoundUpQ96(amount, numberToQ96(BigInt(1)), liquidity))
        }
    return nextSqrtPrice
}