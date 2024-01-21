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
	TOKEN_ID_DEX,
	SUBSTORE_PREFIX_PROPOSALS,
	FEE_PROPOSAL_CREATION,
} from '../../../../src/app/modules/dexGovernance/constants';

describe('DexGovernanceModule:constants', () => {
	it('should generate addresses', () => {
		expect(TOKEN_ID_DEX).toHaveLength(8);
		expect(SUBSTORE_PREFIX_PROPOSALS).toHaveLength(2);
		expect(FEE_PROPOSAL_CREATION).toBe(BigInt(500000000000));
	});
});
