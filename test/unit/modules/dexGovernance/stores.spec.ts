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

import { BaseStore } from 'lisk-sdk';

import { DexGovernanceModule } from '../../../../src/app/modules/dexGovernance/module';

import {
	IndexStore,
	ProposalsStore,
	VotesStore,
} from '../../../../src/app/modules/dexGovernance/stores';

describe('DexGovernanceModule:stores', () => {
	let dexGovernanceModule: DexGovernanceModule;

	beforeAll(() => {
		dexGovernanceModule = new DexGovernanceModule();
	});

	it('stores should be registered and inherit from BaseStore', () => {
		expect(dexGovernanceModule.stores.get(IndexStore)).toBeInstanceOf(BaseStore);
		expect(dexGovernanceModule.stores.get(ProposalsStore)).toBeInstanceOf(BaseStore);
		expect(dexGovernanceModule.stores.get(VotesStore)).toBeInstanceOf(BaseStore);
	});
});
