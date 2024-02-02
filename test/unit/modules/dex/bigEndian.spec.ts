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
	int32be,
	uint32be,
	int32beInv,
	uint32beInv,
} from '../../../../src/app/modules/dex/utils/bigEndian';

describe('dex:bigEndian', () => {
	describe('constructor', () => {
		it('int32be/int32beInv should convert and revert to original values', () => {
			expect(int32be(2147483647)).toBe('7fffffff');
			expect(int32beInv('7fffffff')).toBe(2147483647);
		});
		it('uint32be/uint32beInv should convert and revert to original values', () => {
			expect(uint32be(4294967295)).toBe('ffffffff');
			expect(uint32beInv('ffffffff')).toBe(4294967295);
		});
		it('int32be/int32beInv should fail on out of bounds values', () => {
			expect(() => int32beInv('wrong value')).toThrow();
			expect(() => int32be(2147483648)).toThrow();
		});
		it('uint32be/uint32beInv should fail on out of bounds values', () => {
			expect(() => uint32beInv('wrong value')).toThrow();
			expect(() => uint32be(4294967296)).toThrow();
		});
	});
});
