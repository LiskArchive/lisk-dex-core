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
	ADDRESS_LIQUIDITY_PROVIDER_INCENTIVES,
	ADDRESS_TRADER_INCENTIVES,
	ADDRESS_VALIDATOR_INCENTIVES,
	NUM_BYTES_ADDRESS,
} from '../../../../src/app/modules/dexIncentives/constants';

describe('DexIncentivesModule:constants', () => {
	it('should generate addresses', () => {
		expect(ADDRESS_LIQUIDITY_PROVIDER_INCENTIVES).toHaveLength(NUM_BYTES_ADDRESS);
		expect(ADDRESS_TRADER_INCENTIVES).toHaveLength(NUM_BYTES_ADDRESS);
		expect(ADDRESS_VALIDATOR_INCENTIVES).toHaveLength(NUM_BYTES_ADDRESS);
	});
});
