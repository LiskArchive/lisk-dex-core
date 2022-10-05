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

import { BaseModule, } from 'lisk-sdk';

import { DexModule } from '../../../../src/app/modules/dex/module';
import { DexEndpoint } from '../../../../src/app/modules/dex/endpoint';

import {
	MODULE_NAME_DEX,
	MODULE_ID_DEX,
	defaultConfig
} from '../../../../src/app/modules/dex/constants';

import { DexMethod } from '../../../../src/app/modules/dex/method';
import { createGenesisBlockContext } from '../../../../node_modules/lisk-framework/dist-node/testing';


describe('DexModule', () => {
	let dexModule: DexModule;

	beforeAll(() => {
		dexModule = new DexModule();
	});

	it('should inherit from BaseModule', () => {
		expect(DexModule.prototype).toBeInstanceOf(BaseModule);
	});

	describe('constructor', () => {
		it('should have valid id', () => {
			expect(dexModule.id).toBe(MODULE_ID_DEX);
		});

		it('should have valid name', () => {
			expect(dexModule.name).toBe(MODULE_NAME_DEX);
		});

		it('should expose endpoint', () => {
			expect(dexModule).toHaveProperty('endpoint');
			expect(dexModule.endpoint).toBeInstanceOf(DexEndpoint);
		});

		it('should expose api', () => {
			expect(dexModule).toHaveProperty('method');
			expect(dexModule.method).toBeInstanceOf(DexMethod);
		});
	});

	describe('init', () => {
		it('should initialize config with defaultConfig', async () => {
			const moduleConfig = {
				feeTiers: defaultConfig.feeTiers,
			} as any;
			await expect(dexModule.init({ moduleConfig: {} })).resolves.toBeUndefined();
			expect(dexModule['_moduleConfig']).toEqual(moduleConfig);
		});
		it('should initialize fee tiers', async () => {
			await expect(dexModule.init({moduleConfig: defaultConfig})).resolves.toBeUndefined();

            const defaultFeeTiers = {}
            defaultFeeTiers[100] = 2;
            defaultFeeTiers[500] = 10;
            defaultFeeTiers[3000] = 60;
            defaultFeeTiers[10000] = 200;

			expect(dexModule['_moduleConfig']['feeTiers']).toEqual(defaultFeeTiers);
		});
	});

	describe('initGenesisState', () => {
		it('should setup initial state', async () => {
			const context = createGenesisBlockContext({}).createInitGenesisStateContext();
			return expect(dexModule.initGenesisState?.(context)).toBeUndefined();
		});
	});
});