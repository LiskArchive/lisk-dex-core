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
	divQ96,
	numberToQ96
} from "./q96";

export const MAX_SAFE_INTEGER = BigInt(Number.MAX_SAFE_INTEGER);

export const ZERO = BigInt(0);
export const N_96 = BigInt(96);
export const ONE = BigInt(1);
export const TWO = BigInt(2);
export const MAX_NUM_BYTES_Q96 = 24;

/**
 * Computes floor(sqrt(value))
 * @param value the value for which to compute the square root, rounded down
 */
export const sqrt = (value: bigint): bigint => {
	if (value < ZERO) throw new Error('NEGATIVE');

	// rely on built in sqrt if possible
	if (value <= MAX_SAFE_INTEGER) {
		return BigInt(Math.floor(Math.sqrt(Number(value))));
	}

	let z: bigint;
	let x: bigint;
	z = value;
	x = value / TWO + ONE;
	while (x < z) {
		z = x;
		x = (value / x + x) / TWO;
	}
	return z;
};

export const PRICE_VALUE_FOR_TICK_1 = sqrt(
	divQ96(numberToQ96(BigInt(10001)), numberToQ96(BigInt(10000))) * BigInt(2) ** BigInt(96),
);