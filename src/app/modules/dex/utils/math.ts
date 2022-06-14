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

import JSBI from 'jsbi';
import {toBigIntBE, toBigIntLE, toBufferBE, toBufferLE} from 'bigint-buffer';

import { NUM_BYTES_Q96, PRICE_VALUE_FOR_BIT_POSITION_IN_Q96, MIN_TICK, MAX_TICK } from '../constants';
import { sqrt } from "./math_constants";

import { Q96 } from '../types';
import { qn_r, mul_n, inv_n } from './q96';

export const computeSqrtPrice = (a: JSBI): Buffer => {
    const sq_a = sqrt(a);
    const a_hex: string = sq_a.toString(16);

    return toBufferBE(BigInt(a_hex), NUM_BYTES_Q96);
}

export const tickToPrice = (tickValue: number): Q96 => {

    if(tickValue < MIN_TICK || tickValue > MAX_TICK){
        //return;
    }

    let absTick: number = Math.abs(tickValue)
    let sqrtPrice: JSBI = qn_r(1);
    
    PRICE_VALUE_FOR_BIT_POSITION_IN_Q96.forEach((e, i) => {
        if ((absTick >> i) & 1){
            sqrtPrice = mul_n(sqrtPrice, e);
        }
    });

    if(tickValue > 0)
        sqrtPrice = inv_n(sqrtPrice)

    return sqrtPrice
}