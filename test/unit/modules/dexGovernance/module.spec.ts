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
	cryptography,
	codec,
} from 'lisk-sdk';

import { GenesisBlockContext, EventQueue } from 'lisk-framework/dist-node/state_machine/';
import { PrefixedStateReadWriter } from 'lisk-framework/dist-node/state_machine/prefixed_state_read_writer';
import { loggerMock } from 'lisk-framework/dist-node/testing/mocks';

import {
	IndexStore,
	ProposalsStore,
	VotesStore,
} from '../../../../src/app/modules/dexGovernance/stores';
import { DexGovernanceModule } from '../../../../src/app/modules/dexGovernance/module';
import { DexGovernanceEndpoint } from '../../../../src/app/modules/dexGovernance/endpoint';

import { MODULE_NAME_DEX_GOVERNANCE } from '../../../../src/app/modules/dexGovernance/constants';

import { DexGovernanceMethod } from '../../../../src/app/modules/dexGovernance/method';
import { IndexStoreData } from '../../../../src/app/modules/dexGovernance/stores/indexStore';
import { Proposal, Vote } from '../../../../src/app/modules/dexGovernance/types';
import { genesisDEXGovernanceSchema } from '../../../../src/app/modules/dexGovernance/schemas';

const { createBlockHeaderWithDefaults, InMemoryPrefixedStateDB } = testing;
const { utils } = cryptography;

describe('DexGovernanceModule', () => {
	// const poolId: PoolID = Buffer.from('0000000000000000000001000000000000c8', 'hex');
	let dexGovernanceModule: DexGovernanceModule;
	let tokenModule: TokenModule;
	let posModule: PoSModule;

	const inMemoryPrefixedStateDB = new InMemoryPrefixedStateDB();
	const stateStore: PrefixedStateReadWriter = new PrefixedStateReadWriter(inMemoryPrefixedStateDB);
	const blockHeader = createBlockHeaderWithDefaults({ height: 101 });
	const getAsset = jest.fn();

	const genesisBlockContext: GenesisBlockContext = new GenesisBlockContext({
		logger: loggerMock,
		stateStore,
		header: blockHeader,
		assets: { getAsset },
		eventQueue: new EventQueue(0),
		chainID: utils.getRandomBytes(32),
	});

	let proposalsStore: ProposalsStore;
	let votesStore: VotesStore;

	const proposalsStoreData: Proposal = {
		creationHeight: 100,
		votesYes: BigInt(0),
		votesNo: BigInt(10),
		votesPass: BigInt(0),
		type: 0,
		content: {
			text: Buffer.from('proposalsStoreData'),
			poolID: Buffer.from(''),
			multiplier: 0,
			metadata: {
				title: Buffer.from('proposals metadata'),
				author: Buffer.from('Daniel Salo'),
				summary: Buffer.from('proposal'),
				discussionsTo: Buffer.from('Lightcurve'),
			},
		},
		status: 1,
	};

	const votesStoreData: Vote = {
		address: Buffer.from('00000000', 'hex'),
		voteInfos: [
			{
				proposalIndex: 0,
				decision: 1,
				amount: BigInt(10),
			},
		],
	};

	const genesisBlockExecuteContext: GenesisBlockExecuteContext = genesisBlockContext.createInitGenesisStateContext();

	beforeEach(async () => {
		dexGovernanceModule = new DexGovernanceModule();
		tokenModule = new TokenModule();
		posModule = new PoSModule();
		proposalsStore = dexGovernanceModule.stores.get(ProposalsStore);
		votesStore = dexGovernanceModule.stores.get(VotesStore);

		await proposalsStore.set(genesisBlockExecuteContext, Buffer.alloc(0), proposalsStoreData);
		await votesStore.set(genesisBlockExecuteContext, Buffer.alloc(0), votesStoreData);

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
			const indexStore = dexGovernanceModule.stores.get(IndexStore);
			const indexStoreData: IndexStoreData = await indexStore.get(
				genesisBlockExecuteContext,
				Buffer.alloc(0),
			);
			expect(indexStoreData.newestIndex).toEqual(0);
			expect(indexStoreData.nextOutcomeCheckIndex).toEqual(0);
			expect(indexStoreData.nextQuorumCheckIndex).toEqual(0);
		});

		it('verifyGenesisBlock', () => {
			const proposalsStoreData1 = proposalsStoreData;
			const proposalsStoreData2 = proposalsStoreData;

			proposalsStoreData1.type = 1;
			const genesisDEXGovernanceData = {
				proposalsStore: [proposalsStoreData1],
				votesStore: [
					{
						address: votesStoreData.address,
						votes: votesStoreData,
					},
				],
			};
			let mockAssets = codec.encode(genesisDEXGovernanceSchema, genesisDEXGovernanceData);
			genesisBlockExecuteContext.assets.getAsset = () => mockAssets;
			expect(() => dexGovernanceModule.verifyGenesisBlock(genesisBlockExecuteContext)).toThrow(
				Error('Incentivization proposal must contain a valid pool ID'),
			);

			proposalsStoreData2.creationHeight = 10000;
			proposalsStoreData2.type = 0;
			genesisDEXGovernanceData.proposalsStore = [proposalsStoreData2];
			mockAssets = codec.encode(genesisDEXGovernanceSchema, genesisDEXGovernanceData);
			genesisBlockExecuteContext.assets.getAsset = () => mockAssets;
			expect(() => dexGovernanceModule.verifyGenesisBlock(genesisBlockExecuteContext)).toThrow(
				Error('Proposal can not be created in the future'),
			);
		});
	});
});
