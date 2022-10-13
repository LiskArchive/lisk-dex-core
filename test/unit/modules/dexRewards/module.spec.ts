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

import { BaseModule } from 'lisk-sdk';

import { DexRewardsModule } from '../../../../src/app/modules/dexRewards/module';
import { DexRewardsEndpoint } from '../../../../src/app/modules/dexRewards/endpoint';

import { MODULE_NAME_DEX_REWARDS } from '../../../../src/app/modules/dexRewards/constants';

import { createGenesisBlockContext } from '../../../../node_modules/lisk-framework/dist-node/testing';
import { DexRewardsMethod } from '../../../../src/app/modules/dexRewards/method';

describe('DexRewardsModule', () => {
	let dexRewardsModule: DexRewardsModule;

	beforeAll(() => {
		dexRewardsModule = new DexRewardsModule();
	});

	it('should inherit from BaseModule', () => {
		expect(DexRewardsModule.prototype).toBeInstanceOf(BaseModule);
	});

	describe('constructor', () => {
		it('should have valid name', () => {
			expect(dexRewardsModule.name).toBe(MODULE_NAME_DEX_REWARDS);
		});

		it('should expose endpoint', () => {
			expect(dexRewardsModule).toHaveProperty('endpoint');
			expect(dexRewardsModule.endpoint).toBeInstanceOf(DexRewardsEndpoint);
		});

		it('should expose method', () => {
			expect(dexRewardsModule).toHaveProperty('method');
			expect(dexRewardsModule.method).toBeInstanceOf(DexRewardsMethod);
		});
	});

	describe('initGenesisState', () => {
		it('should setup initial state', async () => {
			const context = createGenesisBlockContext({}).createInitGenesisStateContext();
			return expect(dexRewardsModule.initGenesisState?.(context)).toBeUndefined();
		});
	});
});
