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
	addQ96,
	divQ96,
	numberToQ96,
	mulQ96,
	subQ96,
	invQ96,
	bytesToQ96,
	q96ToBytes,
	q96ToInt,
	mulDivQ96,
	q96ToIntRoundUp,
} from '../../../../src/app/modules/dex/utils/q96';

import { Q96 } from '../../../../src/app/modules/dex/types';

import { MAX_SQRT_RATIO, MAX_UINT_64 } from '../../../../src/app/modules/dex/constants';

describe('DexQ96Module', () => {
	describe('constructor', () => {
		const testValueMax: Q96 = numberToQ96(MAX_SQRT_RATIO);
		const testValueMaxUint: Q96 = numberToQ96(BigInt(MAX_UINT_64));
		const testValue2: Q96 = numberToQ96(BigInt(2));

		it('add', () => {
			expect(q96ToInt(addQ96(testValueMaxUint, testValue2))).toBe(BigInt('18446744073709551617'));
		});

		it('sub', () => {
			expect(q96ToInt(subQ96(testValueMax, testValue2))).toBe(
				BigInt('1461446704550679960896629428549052887957817041880'),
			);
		});

		it('mul', () => {
			expect(q96ToInt(mulQ96(testValueMaxUint, testValue2))).toBe(BigInt('36893488147419103230'));
		});

		it('div', () => {
			const one = numberToQ96(BigInt(1));
			const div = divQ96(one, testValue2);
			expect(q96ToInt(div)).toEqual(BigInt('0'));
			expect(q96ToIntRoundUp(div)).toEqual(BigInt('1'));

			const test = mulQ96(testValue2, testValueMaxUint);
			expect(divQ96(test, testValueMaxUint)).toEqual(testValue2);

			const zero = numberToQ96(BigInt(0));
			expect(() => divQ96(testValue2, zero)).toThrow();
		});

		it('mulDiv', () => {
			const test = divQ96(testValueMax, testValueMax);
			expect(mulDivQ96(test, numberToQ96(BigInt('4')), numberToQ96(BigInt('4')))).toEqual(test);
		});

		it('invQ96', () => {
			const three = numberToQ96(BigInt(3)); // 3 is an odd number, not nicely invertible in binary
			expect(q96ToInt(invQ96(invQ96(three)))).toEqual(BigInt('3'));
		});

		it('bytesToQ96 and q96ToBytes', () => {
			expect(bytesToQ96(q96ToBytes(testValueMaxUint))).toBe(testValueMaxUint);
		});

		it('q96ToBytes for 0 values', () => {
			expect(q96ToBytes(numberToQ96(BigInt(0)))).toStrictEqual(Buffer.from([]));
		});

		it('bytesToQ96 for 0 values', () => {
			expect(bytesToQ96(q96ToBytes(numberToQ96(BigInt(0))))).toStrictEqual(BigInt(0));
		});
	});
});
