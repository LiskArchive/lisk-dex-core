import {
	addQ96,
	divQ96,
	numberToQ96,
	mulQ96,
	subQ96,
	bytesToQ96,
	q96ToBytes,
	q96ToInt,
	mulDivQ96
} from '../../../../src/app/modules/dex/utils/q96';

import {
	Q96
} from '../../../../src/app/modules/dex/types';

import {
	MAX_SQRT_RATIO,
	MAX_UINT_64
} from '../../../../src/app/modules/dex/constants';

describe('DexQ96Module', () => {
	describe('constructor', () => {
		const testValueMax: Q96 = numberToQ96(MAX_SQRT_RATIO);
		const testValueMaxUint: Q96 = numberToQ96(BigInt(MAX_UINT_64));
		const testValue2: Q96 = numberToQ96(BigInt(2));

		it('add', async () => {
			expect(q96ToInt(addQ96(testValueMaxUint, testValue2))).toBe(BigInt("18446744073709551617"));
		});

		it('sub', async () => {
			expect(q96ToInt(subQ96(testValueMax, testValue2))).toBe(BigInt("1461446703529909599612049957420313862569572983182"));
		});

		it('mul', async () => {
			expect(q96ToInt(mulQ96(testValueMaxUint, testValue2))).toBe(BigInt("36893488147419103230"));
		});

		it('div', async () => {
			const test = mulQ96(testValue2, testValueMaxUint);
			expect(divQ96(test, q96ToInt(testValueMaxUint))).toEqual(q96ToInt(testValue2));
		});

		it('mulDiv', async () => {
			const test = divQ96(testValueMaxUint, testValue2);
			expect(mulDivQ96(test, numberToQ96(BigInt('2')), numberToQ96(BigInt('2')))).toEqual(test);
		});
		
		it('bytesToQ96 and q96ToBytes', async () => {
			expect(bytesToQ96(q96ToBytes(testValueMaxUint))).toBe(testValueMaxUint)
		});
	});
});