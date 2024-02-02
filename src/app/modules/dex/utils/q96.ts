/* eslint-disable no-bitwise */
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
import { Q96 } from '../types';
import { ONE, TWO, N_96, MAX_NUM_BYTES_Q96 } from './mathConstants';

// Fixed Point Arithmetic
export const numberToQ96 = (r: bigint): Q96 => {
	const _exp: bigint = TWO ** N_96;
	const _r = BigInt(r);
	const num: bigint = _r * _exp;

	return num;
};

export const roundDownQ96 = (a: Q96): bigint => a >> N_96;

export const roundUpQ96 = (a: Q96): bigint => {
	const _x = ONE << N_96;
	const _y = a % _x;

	const _z = Number(_y);

	if (_z === 0) {
		return a >> N_96;
	}

	const _r = a >> N_96;
	return _r + ONE;
};

// Arithmetic
export const addQ96 = (a: Q96, b: Q96): Q96 => a + b;

export const subQ96 = (a: Q96, b: Q96): Q96 => {
	if (a >= b) {
		return a - b;
	}

	throw new Error("Result can't be negative");
};

export const mulQ96 = (a: Q96, b: Q96): Q96 => {
	const _x: bigint = a * b;

	return _x >> N_96;
};

export const divQ96 = (a: Q96, b: Q96): Q96 => {
	const _x: Q96 = a << N_96;
	return _x / b;
};

export const mulDivQ96 = (a: Q96, b: Q96, c: Q96): bigint => {
	const _x: bigint = a * b;

	const _y: bigint = _x << N_96;
	const _z: bigint = _y / c;

	return roundDownQ96(_z);
};

export const mulDivRoundUpQ96 = (a: Q96, b: Q96, c: Q96): bigint => {
	const _x: bigint = a * b;

	const _y: bigint = _x << N_96;
	const _z: bigint = _y / c;

	return roundUpQ96(_z);
};

export const q96ToInt = (a: Q96): bigint => roundDownQ96(a);

export const q96ToIntRoundUp = (a: Q96): bigint => roundUpQ96(a);

export const invQ96 = (a: Q96): Q96 => {
	const _x: bigint = ONE << N_96;
	return divQ96(_x, a);
};

// Q96 Encoding and Decoding
export const bytesToQ96 = (numberBytes: Buffer): Q96 => {
	if (numberBytes.length > MAX_NUM_BYTES_Q96) {
		throw new Error();
	}

	const hexArr: string[] = [];

	for (const currentNumberBytes of numberBytes) {
		const current = currentNumberBytes < 0 ? currentNumberBytes + 256 : currentNumberBytes;

		hexArr.push((current >>> 4).toString(16));

		hexArr.push((current & 0xf).toString(16));
	}

	if (hexArr.length === 0) return BigInt(0);

	const hexBi = hexArr.join('');

	// return big-endian decoding of bytes
	return BigInt(`0x${hexBi}`);
};

export const q96ToBytes = (numberQ96: Q96): Buffer => {
	if (numberQ96 === BigInt(0)) return Buffer.from([]);

	const _hex: string = numberQ96.toString(16);

	let _byteArr = 0;

	for (let c = 0; c < _hex.length; c += 2) {
		_byteArr += 1;
	}

	if (_byteArr > MAX_NUM_BYTES_Q96) {
		throw new Error('Overflow when serializing a Q96 number');
	}

	// return result padded to length NUM_BYTES_Q96 with zero bytes
	// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
	return toBufferBE(BigInt(`0x${_hex}`), MAX_NUM_BYTES_Q96); // big-endian encoding of numberQ96 as integer
};
