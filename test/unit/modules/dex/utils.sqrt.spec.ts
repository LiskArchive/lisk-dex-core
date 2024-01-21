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

import { sqrt } from '../../../../src/app/modules/dex/utils/mathConstants';
import { MAX_SQRT_RATIO } from '../../../../src/app/modules/dex/constants';

describe('sqrt', () => {
	it('should calculate sqrt', () => {
		expect(sqrt(BigInt(100))).toBe(BigInt(10));
		expect(sqrt(MAX_SQRT_RATIO)).toBe(BigInt('1208903099735739763107066'));
	});
});
