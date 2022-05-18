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
import {Q96} from '../types';
import { NUM_BYTES_Q96 } from '../constants';
import { ONE, TWO, N_96} from "./math_constants";


//Fixed Point Arithmetic
export const qn_r = (r: number): JSBI => {
    const _exp: JSBI = JSBI.exponentiate(TWO, N_96);
    const _r: JSBI = JSBI.BigInt(r);
    const num: JSBI =  JSBI.multiply(_r, _exp);

    return num;
}

export const roundDown_n = (a: JSBI): JSBI => {
    return JSBI.signedRightShift(a, N_96 );
}

export const roundUp_n = (a: JSBI) => {
    const _x = JSBI.signedRightShift(ONE, N_96);
    const _y = JSBI.remainder(a, _x)

    const _z = JSBI.toNumber(_y);

    if(_z === 0){
        return JSBI.signedRightShift(a,N_96);
    }
    else{
        const _r = JSBI.signedRightShift(a, N_96);
        return JSBI.add(_r,ONE);
    }
}


// Arithmetic
export const add_n = (a: JSBI, b: JSBI): JSBI => {
    return JSBI.add(a, b);
}

export const sub_n = (a: JSBI, b: JSBI): JSBI => {
    if(JSBI.greaterThanOrEqual(a, b)){
        return JSBI.subtract(a, b);
    }
    else{
        return JSBI.BigInt(0); //To discuss
    }
} 

export const mul_n = (a: JSBI, b: JSBI): JSBI => {
    const _x: JSBI = JSBI.multiply(a,b);
    return JSBI.signedRightShift(_x, N_96);
}

export const div_n = (a: JSBI, b: JSBI): JSBI => {
    const _x: JSBI = JSBI.signedRightShift(a, N_96)
    return JSBI.divide(_x, b); //Round-down. Note, BigInt division automatically rounds down
}

export const muldiv_n = (a: JSBI, b: JSBI, c: JSBI): JSBI => {
    const _x: JSBI = JSBI.multiply(a,b);
    const _y: JSBI = JSBI.signedRightShift(_x, N_96);
    const _z: JSBI = JSBI.divide(_y, c);

    return roundDown_n(_z); //Round-down. Note, BigInt division automatically rounds down
}

export const muldiv_n_RoundUp = (a: JSBI, b: JSBI, c: JSBI): JSBI => {
    const _x: JSBI = JSBI.multiply(a,b);
    const _y: JSBI = JSBI.signedRightShift(_x, N_96);
    const _z: JSBI = JSBI.divide(_y,c);

    return roundUp_n(_z)  //Round-down. Note, BigInt division automatically rounds down
}

export const Q_n_ToInt = (a: JSBI): JSBI => {
    return roundDown_n(a);
}
  
export const Q_n_ToIntRoundUp = (a: JSBI): JSBI => {
    return roundUp_n(a);
}
  
export const inv_n = (a: JSBI): JSBI => {
    const _x: JSBI = JSBI.signedRightShift(ONE, N_96);
    return div_n(_x, a);  
}


// Q96 Encoding and Decoding
export const bytesToQ96 = (numberBytes: Buffer): Q96 => {
    if( numberBytes.length > NUM_BYTES_Q96){
        //raise Error()
        //return;
    }

    let _hex: string[] = [];

    for (let i = 0; i < numberBytes.length; i++) {
        let current = numberBytes[i] < 0 ? numberBytes[i] + 256 : numberBytes[i];
        _hex.push((current >>> 4).toString(16));
        _hex.push((current & 0xF).toString(16));
    }

    let _hex_bi = _hex.join("");

    //return big-endian decoding of bytes
    return JSBI.BigInt(Number(_hex_bi));
}

export const q96ToBytes = (numberQ96: Q96): Buffer => {

    const _hex: string = numberQ96.toString(16);
    let _byteArr: number[] = [];

    for (let c = 0; c < _hex.length; c += 2){
        _byteArr.push(parseInt(_hex.substring(c, 2), 16));
    }
    
    if(_byteArr.length > NUM_BYTES_Q96){
        // raise Error("Overflow when serializing a Q96 number")
    }

    // return result padded to length NUM_BYTES_Q96 with zero bytes
    return toBufferBE(BigInt(_hex), NUM_BYTES_Q96) //big-endian encoding of numberQ96 as integer
}