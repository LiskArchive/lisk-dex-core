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
import invariant from 'tiny-invariant'

export const MAX_SAFE_INTEGER = JSBI.BigInt(Number.MAX_SAFE_INTEGER)

export const ZERO = JSBI.BigInt(0)
export const N_96 = JSBI.BigInt(96);
export const ONE = JSBI.BigInt(1);
export const TWO = JSBI.BigInt(2);
//export const SQRT_EXP = JSBI.divide(ONE, TWO);

/**
 * Computes floor(sqrt(value))
 * @param value the value for which to compute the square root, rounded down
 */
export const sqrt = (value: JSBI): JSBI => {
  invariant(JSBI.greaterThanOrEqual(value, ZERO), 'NEGATIVE')

  // rely on built in sqrt if possible
  if (JSBI.lessThan(value, MAX_SAFE_INTEGER)) {
    return JSBI.BigInt(Math.floor(Math.sqrt(JSBI.toNumber(value))))
  }

  let z: JSBI
  let x: JSBI
  z = value
  x = JSBI.add(JSBI.divide(value, TWO), ONE)
  while (JSBI.lessThan(x, z)) {
    z = x
    x = JSBI.divide(JSBI.add(JSBI.divide(value, x), x), TWO)
  }
  return z
}
