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

import { FeeMethod, ModuleMetadata } from 'lisk-framework';
import {
	BaseModule,
	PoSModule,
	TokenModule,
	GenesisBlockExecuteContext,
	testing,
	cryptography,
	codec,
	BlockExecuteContext,
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
import {
	GenesisDEXGovernanceData,
	Index,
	Proposal,
	Vote,
} from '../../../../src/app/modules/dexGovernance/types';

import {
	EVENT_NAME_PROPOSAL_OUTCOME_CHECKED,
	EVENT_NAME_PROPOSAL_QUORUM_CHECKED,
	MODULE_NAME_DEX_GOVERNANCE,
	PROPOSAL_STATUS_ACTIVE,
	PROPOSAL_TYPE_UNIVERSAL,
	QUORUM_PERCENTAGE,
	VOTE_DURATION,
} from '../../../../src/app/modules/dexGovernance/constants';

import { DexGovernanceMethod } from '../../../../src/app/modules/dexGovernance/method';
import { IndexStoreData } from '../../../../src/app/modules/dexGovernance/stores/indexStore';
import { genesisDEXGovernanceSchema } from '../../../../src/app/modules/dexGovernance/schemas';

const { createBlockHeaderWithDefaults, InMemoryPrefixedStateDB, createBlockContext } = testing;
const { utils } = cryptography;

describe('DexGovernanceModule', () => {
	// const poolId: PoolID = Buffer.from('0000000000000000000001000000000000c8', 'hex');
	let dexGovernanceModule: DexGovernanceModule;
	let tokenModule: TokenModule;
	let posModule: PoSModule;
	let feeMethod: FeeMethod;

	const inMemoryPrefixedStateDB = new InMemoryPrefixedStateDB();
	const stateStore: PrefixedStateReadWriter = new PrefixedStateReadWriter(inMemoryPrefixedStateDB);
	const blockHeader = createBlockHeaderWithDefaults({ height: 100 + VOTE_DURATION });
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

	const genesisBlockExecuteContext: GenesisBlockExecuteContext =
		genesisBlockContext.createInitGenesisStateContext();

	beforeEach(async () => {
		dexGovernanceModule = new DexGovernanceModule();
		tokenModule = new TokenModule();
		posModule = new PoSModule();
		feeMethod = new FeeMethod(dexGovernanceModule.stores, dexGovernanceModule.events);
		proposalsStore = dexGovernanceModule.stores.get(ProposalsStore);
		votesStore = dexGovernanceModule.stores.get(VotesStore);

		await proposalsStore.set(genesisBlockExecuteContext, Buffer.alloc(0), proposalsStoreData);
		await votesStore.set(genesisBlockExecuteContext, Buffer.alloc(0), votesStoreData);

		tokenModule.method.mint = jest.fn().mockImplementation(async () => Promise.resolve());
		tokenModule.method.lock = jest.fn().mockImplementation(async () => Promise.resolve());
		tokenModule.method.unlock = jest.fn().mockImplementation(async () => Promise.resolve());
		tokenModule.method.transfer = jest.fn().mockImplementation(async () => Promise.resolve());
		tokenModule.method.getLockedAmount = jest.fn().mockResolvedValue(BigInt(1000));
		tokenModule.method.getTotalSupply = jest
			.fn()
			.mockResolvedValue({ totalSupply: [{ totalSupply: BigInt(1000000) }] });

		dexGovernanceModule.addDependencies(tokenModule.method, posModule.method, feeMethod);
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
			expect(indexStoreData.newestIndex).toBe(0);
			expect(indexStoreData.nextOutcomeCheckIndex).toBe(0);
			expect(indexStoreData.nextQuorumCheckIndex).toBe(0);
		});

		it('verifyGenesisBlock', () => {
			expect(dexGovernanceModule.verifyGenesisBlock(genesisBlockExecuteContext)).toBeUndefined();
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

			proposalsStoreData2.creationHeight = 1000000;
			proposalsStoreData2.type = 0;
			genesisDEXGovernanceData.proposalsStore = [proposalsStoreData2];
			mockAssets = codec.encode(genesisDEXGovernanceSchema, genesisDEXGovernanceData);
			genesisBlockExecuteContext.assets.getAsset = () => mockAssets;
			expect(() => dexGovernanceModule.verifyGenesisBlock(genesisBlockExecuteContext)).toThrow(
				Error('Proposal can not be created in the future'),
			);
		});
	});

	describe('beforeTransactionsExecute', () => {
		let blockExecuteContext: BlockExecuteContext;

		beforeEach(async () => {
			blockExecuteContext = createBlockContext({
				header: blockHeader,
			}).getBlockExecuteContext();

			const proposal: Proposal = {
				creationHeight: 1,
				votesYes: BigInt(QUORUM_PERCENTAGE) * BigInt('3000000000000'),
				votesNo: BigInt(100),
				votesPass: BigInt(50),
				type: PROPOSAL_TYPE_UNIVERSAL,
				content: {
					text: Buffer.alloc(1),
					poolID: Buffer.alloc(0),
					multiplier: 2,
					metadata: {
						title: Buffer.alloc(1),
						author: Buffer.alloc(1),
						summary: Buffer.alloc(1),
						discussionsTo: Buffer.alloc(1),
					},
				},
				status: PROPOSAL_STATUS_ACTIVE,
			};

			const index: Index = {
				newestIndex: 1,
				nextOutcomeCheckIndex: 100,
				nextQuorumCheckIndex: 100,
			};

			const vote: Vote = {
				address: Buffer.from('00000000', 'hex'),
				voteInfos: [
					{
						proposalIndex: 0,
						decision: 1,
						amount: BigInt(1000),
					},
				],
			};

			const indexBuffer = Buffer.from('00000064', 'hex');
			const indexStore = dexGovernanceModule.stores.get(IndexStore);
			await proposalsStore.set(blockExecuteContext, indexBuffer, proposal);
			await indexStore.set(blockExecuteContext, Buffer.alloc(0), index);
			await votesStore.set(blockExecuteContext, Buffer.from('0', 'hex'), vote);
		});
		it(`should call token methods and emit events`, async () => {
			await dexGovernanceModule.beforeTransactionsExecute(blockExecuteContext);

			const events = blockExecuteContext.eventQueue.getEvents();
			const proposalQuorumCheckedEvents = events.filter(
				e => e.toObject().name === EVENT_NAME_PROPOSAL_QUORUM_CHECKED,
			);
			expect(proposalQuorumCheckedEvents).toHaveLength(1);

			const proposalOutcomeCheckedEvents = events.filter(
				e => e.toObject().name === EVENT_NAME_PROPOSAL_OUTCOME_CHECKED,
			);
			expect(proposalOutcomeCheckedEvents).toHaveLength(1);
		});
	});

	describe('metadata', () => {
		it('should return metadata', () => {
			const metadata: ModuleMetadata = dexGovernanceModule.metadata();
			expect(metadata.stores).toHaveLength(3);
			expect(metadata.endpoints).toHaveLength(3);
			expect(metadata.commands).toHaveLength(2);
			expect(metadata.assets).toHaveLength(0);
			expect(metadata.events).toHaveLength(5);
		});
	});

	describe('addDependencies', () => {
		it('should update dependencies', () => {
			expect(() =>
				dexGovernanceModule.addDependencies(tokenModule.method, posModule.method, feeMethod),
			).not.toThrow();
			expect(dexGovernanceModule._tokenMethod).toEqual(tokenModule.method);
			expect(dexGovernanceModule._posMethod).toEqual(posModule.method);
		});
	});

	describe('verifyGenesisBlock', () => {
		it('verifyGenesisBlock should return undefined', () => {
			expect(() => dexGovernanceModule.verifyGenesisBlock(genesisBlockExecuteContext)).toThrow(
				Error('Proposal can not be created in the future'),
			);
		});

		it('Incorrect vote data.', () => {
			proposalsStoreData.creationHeight = 0;
			const genesisDEXData: GenesisDEXGovernanceData = {
				proposalsStore: [
					{
						...proposalsStoreData,
					},
				],
				votesStore: [],
			};

			const mockAssets = codec.encode(genesisDEXGovernanceSchema, genesisDEXData);
			genesisBlockExecuteContext.assets.getAsset = () => mockAssets;
			expect(() => dexGovernanceModule.verifyGenesisBlock(genesisBlockExecuteContext)).toThrow(
				Error('Incorrect vote data about the proposals with recorded votes'),
			);
		});

		it('Incorrect proposal index.', () => {
			proposalsStoreData.creationHeight = 0;
			const genesisDEXData: GenesisDEXGovernanceData = {
				proposalsStore: [],
				votesStore: [
					{
						address: Buffer.from('00000000', 'hex'),
						votes: votesStoreData,
					},
				],
			};

			const mockAssets = codec.encode(genesisDEXGovernanceSchema, genesisDEXData);
			genesisBlockExecuteContext.assets.getAsset = () => mockAssets;
			expect(() => dexGovernanceModule.verifyGenesisBlock(genesisBlockExecuteContext)).toThrow(
				Error('Vote info references incorrect proposal index'),
			);
		});
	});
});
