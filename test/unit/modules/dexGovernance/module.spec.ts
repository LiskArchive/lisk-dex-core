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

import { BaseModule, PoSModule, TokenModule } from 'lisk-sdk';

import { DexGovernanceModule } from '../../../../src/app/modules/dexGovernance/module';
import { DexGovernanceEndpoint } from '../../../../src/app/modules/dexGovernance/endpoint';

import { MODULE_NAME_DEX_GOVERNANCE } from '../../../../src/app/modules/dexGovernance/constants';

import { DexGovernanceMethod } from '../../../../src/app/modules/dexGovernance/method';
import { FeeMethod } from 'lisk-framework';

describe('DexGovernanceModule', () => {
	let dexGovernanceModule: DexGovernanceModule;
	let tokenModule: TokenModule;
	let posModule: PoSModule;
	let feeMethod: FeeMethod;

	beforeEach(() => {
		dexGovernanceModule = new DexGovernanceModule();
		tokenModule = new TokenModule();
		posModule = new PoSModule();
		feeMethod = new FeeMethod(dexGovernanceModule.stores, dexGovernanceModule.events);

		tokenModule.method.mint = jest.fn().mockImplementation(async () => Promise.resolve());
		tokenModule.method.lock = jest.fn().mockImplementation(async () => Promise.resolve());
		tokenModule.method.unlock = jest.fn().mockImplementation(async () => Promise.resolve());
		tokenModule.method.transfer = jest.fn().mockImplementation(async () => Promise.resolve());
		tokenModule.method.getLockedAmount = jest.fn().mockResolvedValue(BigInt(1000));

		dexGovernanceModule.addDependencies(tokenModule.method, posModule.method);
	});

	it('should inherit from BaseModule', () => {
		expect(DexGovernanceModule.prototype).toBeInstanceOf(BaseModule);
	});

	describe('constructor', () => {
		it('should have valid name', () => {
			expect(dexGovernanceModule.name).toBe(MODULE_NAME_DEX_GOVERNANCE);
		});

		it('should expose endpoint', () => {
			expect(dexGovernanceModule).toHaveProperty('endpoint');
			expect(dexGovernanceModule.endpoint).toBeInstanceOf(DexGovernanceEndpoint);
		});

		it('should expose method', () => {
			expect(dexGovernanceModule).toHaveProperty('method');
			expect(dexGovernanceModule.method).toBeInstanceOf(DexGovernanceMethod);
		});
	});
});
