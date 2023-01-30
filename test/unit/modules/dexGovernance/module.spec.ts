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

import {
	BaseModule,
	PoSModule,
	TokenModule,
	GenesisBlockExecuteContext,
	testing,
	cryptography
} from 'lisk-sdk';

import { IndexStore } from '../../../../src/app/modules/dexGovernance/stores';

import { DexGovernanceModule } from '../../../../src/app/modules/dexGovernance/module';
import { DexGovernanceEndpoint } from '../../../../src/app/modules/dexGovernance/endpoint';
import { GenesisBlockContext } from 'lisk-framework/dist-node/state_machine/';
import { PrefixedStateReadWriter } from 'lisk-framework/dist-node/state_machine/prefixed_state_read_writer';
import { EventQueue } from 'lisk-framework/dist-node/state_machine';
import { loggerMock } from 'lisk-framework/dist-node/testing/mocks';

import { InMemoryPrefixedStateDB } from './inMemoryPrefixedState';
import { MODULE_NAME_DEX_GOVERNANCE } from '../../../../src/app/modules/dexGovernance/constants';

import { DexGovernanceMethod } from '../../../../src/app/modules/dexGovernance/method';

const { createBlockHeaderWithDefaults } = testing;
const { utils } = cryptography;

describe('DexGovernanceModule', () => {
	let dexGovernanceModule: DexGovernanceModule;
	let tokenModule: TokenModule;
	let posModule: PoSModule;
	let geneSisBlockContext: GenesisBlockContext;

	const inMemoryPrefixedStateDB = new InMemoryPrefixedStateDB();
	const stateStore: PrefixedStateReadWriter = new PrefixedStateReadWriter(inMemoryPrefixedStateDB);
	const blockHeader = createBlockHeaderWithDefaults({ height: 101 });

	geneSisBlockContext = new GenesisBlockContext({
		logger: loggerMock,
		stateStore,
		header: blockHeader,
		assets: { getAsset: jest.fn() },
		eventQueue: new EventQueue(0),
		chainID: utils.getRandomBytes(32)
	});
	const genesisBlockExecuteContext: GenesisBlockExecuteContext = geneSisBlockContext.createInitGenesisStateContext();

	beforeEach(() => {
		dexGovernanceModule = new DexGovernanceModule();
		tokenModule = new TokenModule();
		posModule = new PoSModule();


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

		it('initGenesisState', async () => {
			await dexGovernanceModule.initGenesisState(genesisBlockExecuteContext);
			const indexStore: IndexStore = dexGovernanceModule.stores.get(IndexStore);
			const indexStoreData = await indexStore.get(genesisBlockExecuteContext, Buffer.alloc(0));
			console.log("spec indexStoreData: ", indexStoreData);
		});

		it('verifyGenesisBlock', () => {
			dexGovernanceModule.verifyGenesisBlock(genesisBlockExecuteContext);
		});
	});
});
