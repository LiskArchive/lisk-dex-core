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
	BaseModule,
	FeeModule,
	ModuleMetadata,
	TokenModule,
	ValidatorsModule,
	codec,
	cryptography,
	testing,
} from 'lisk-sdk';
import { EventQueue, GenesisBlockContext } from 'lisk-framework/dist-node/state_machine';
import { PrefixedStateReadWriter } from 'lisk-framework/dist-node/state_machine/prefixed_state_read_writer';
import { loggerMock } from 'lisk-framework/dist-node/testing/mocks';

import { DexModule } from '../../../../src/app/modules/dex/module';
import { DexEndpoint } from '../../../../src/app/modules/dex/endpoint';

import {
	MODULE_NAME_DEX,
	MODULE_ID_DEX,
	defaultConfig,
} from '../../../../src/app/modules/dex/constants';

import { DexMethod } from '../../../../src/app/modules/dex/method';
import { createGenesisBlockContext } from '../../../../node_modules/lisk-framework/dist-node/testing';
import { genesisDEXSchema } from '../../../../src/app/modules/dex/schemas';
import { GenesisDEX, PoolID } from '../../../../src/app/modules/dex/types';
import { DexGlobalStoreData } from '../../../../src/app/modules/dex/stores/dexGlobalStore';
import { numberToQ96, q96ToBytes } from '../../../../src/app/modules/dex/utils/q96';
import { tickToPrice } from '../../../../src/app/modules/dex/utils/math';

const { createBlockHeaderWithDefaults, InMemoryPrefixedStateDB } = testing;
const { utils } = cryptography;

describe('DexModule', () => {
	let dexModule: DexModule;
	let tokenModule: TokenModule;
	let validatorModule: ValidatorsModule;
	let feeModule: FeeModule;

	const poolId: PoolID = q96ToBytes(numberToQ96(BigInt(0)));

	const stateStore: PrefixedStateReadWriter = new PrefixedStateReadWriter(
		new InMemoryPrefixedStateDB(),
	);
	const blockHeader = createBlockHeaderWithDefaults({ height: 100 });
	const getAsset = jest.fn();

	const genesisBlockContext: GenesisBlockContext = new GenesisBlockContext({
		logger: loggerMock,
		stateStore,
		header: blockHeader,
		assets: { getAsset },
		eventQueue: new EventQueue(0),
		chainID: utils.getRandomBytes(32),
	});

	const genesisBlockExecuteContext = genesisBlockContext.createInitGenesisStateContext();

	const dexGlobalStoreData: DexGlobalStoreData = {
		positionCounter: BigInt(15),
		poolCreationSettings: [{ feeTier: 100, tickSpacing: 1 }],
		incentivizedPools: [{ poolId, multiplier: 10 }],
		totalIncentivesMultiplier: 10,
	};

	const poolsStoreData = {
		poolId,
		liquidity: BigInt(5),
		sqrtPrice: q96ToBytes(BigInt(tickToPrice(5))),
		incentivesPerLiquidityAccumulator: q96ToBytes(numberToQ96(BigInt(0))),
		heightIncentivesUpdate: 5,
		feeGrowthGlobal0: q96ToBytes(numberToQ96(BigInt(0))),
		feeGrowthGlobal1: q96ToBytes(numberToQ96(BigInt(0))),
		tickSpacing: 1,
	};

	const priceTicksStoreDataTickLower = {
		tickId: q96ToBytes(numberToQ96(BigInt(0))),
		liquidityNet: BigInt(5),
		liquidityGross: BigInt(5),
		feeGrowthOutside0: q96ToBytes(numberToQ96(BigInt(0))),
		feeGrowthOutside1: q96ToBytes(numberToQ96(BigInt(0))),
		incentivesPerLiquidityOutside: q96ToBytes(numberToQ96(BigInt(2))),
	};

	beforeAll(() => {
		dexModule = new DexModule();
		tokenModule = new TokenModule();
		validatorModule = new ValidatorsModule();
		feeModule = new FeeModule();

		tokenModule.method.mint = jest.fn().mockImplementation(async () => Promise.resolve());
		tokenModule.method.lock = jest.fn().mockImplementation(async () => Promise.resolve());
		tokenModule.method.unlock = jest.fn().mockImplementation(async () => Promise.resolve());
		tokenModule.method.transfer = jest.fn().mockImplementation(async () => Promise.resolve());
		tokenModule.method.getLockedAmount = jest.fn().mockResolvedValue(BigInt(1000));
		dexModule.addDependencies(tokenModule.method, validatorModule.method, feeModule.method);
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
			await expect(
				dexModule.init({ moduleConfig: defaultConfig, genesisConfig: {} as any }),
			).resolves.not.toThrow();
			expect(dexModule['_moduleConfig']).toEqual(moduleConfig);
		});
		it('should initialize fee tiers', async () => {
			await expect(
				dexModule.init({ moduleConfig: defaultConfig, genesisConfig: {} as any }),
			).resolves.not.toThrow();

			const defaultFeeTiers = {};
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
			await expect(dexModule.initGenesisState(context)).resolves.not.toThrow();
		});
	});

	describe('metadata', () => {
		it('should return metadata', () => {
			const metadata: ModuleMetadata = dexModule.metadata();
			expect(metadata.stores).toHaveLength(4);
			expect(metadata.endpoints).toHaveLength(21);
			expect(metadata.commands).toHaveLength(8);
			expect(metadata.assets).toHaveLength(0);
			expect(metadata.events).toHaveLength(12);
		});
	});

	describe('addDependencies', () => {
		it('should update dependencies', () => {
			expect(() =>
				dexModule.addDependencies(tokenModule.method, validatorModule.method, feeModule.method),
			).not.toThrow();
			expect(dexModule._tokenMethod).toEqual(tokenModule.method);
			expect(dexModule._validatorsMethod).toEqual(validatorModule.method);
			expect(dexModule._feeMethod).toEqual(feeModule.method);
		});
	});

	describe('verifyGenesisBlock', () => {
		it('verifyGenesisBlock should return undefined', () => {
			expect(dexModule.verifyGenesisBlock(genesisBlockExecuteContext)).toBeUndefined();
		});

		it('Incorrect position counter.', () => {
			const genesisDEXData: GenesisDEX = {
				poolSubstore: [],
				priceTickSubstore: [],
				positionSubstore: [],
				dexGlobalDataSubstore: dexGlobalStoreData,
			};

			const mockAssets = codec.encode(genesisDEXSchema, genesisDEXData);
			genesisBlockExecuteContext.assets.getAsset = () => mockAssets;
			expect(() => dexModule.verifyGenesisBlock(genesisBlockExecuteContext)).toThrow(
				Error('Incorrect position counter.'),
			);
		});

		it('Invalid poolId on incentivizedPool', () => {
			const genesisDEXData: GenesisDEX = {
				poolSubstore: [],
				priceTickSubstore: [],
				positionSubstore: [],
				dexGlobalDataSubstore: {
					...dexGlobalStoreData,
					positionCounter: BigInt(0),
				},
			};

			const mockAssets = codec.encode(genesisDEXSchema, genesisDEXData);
			genesisBlockExecuteContext.assets.getAsset = () => mockAssets;
			expect(() => dexModule.verifyGenesisBlock(genesisBlockExecuteContext)).toThrow(
				Error(
					// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
					`Invalid poolId on incentivizedPool ${dexGlobalStoreData.incentivizedPools[0].poolId}`,
				),
			);
		});

		it('totalIncentivesMultiplier is not equal to the sum of multipliers in all the incentivized pools.', () => {
			const genesisDEXData: GenesisDEX = {
				poolSubstore: [poolsStoreData],
				priceTickSubstore: [],
				positionSubstore: [],
				dexGlobalDataSubstore: {
					...dexGlobalStoreData,
					positionCounter: BigInt(0),
					totalIncentivesMultiplier: 20,
				},
			};

			const mockAssets = codec.encode(genesisDEXSchema, genesisDEXData);
			genesisBlockExecuteContext.assets.getAsset = () => mockAssets;
			expect(() => dexModule.verifyGenesisBlock(genesisBlockExecuteContext)).toThrow(
				Error(
					`totalIncentivesMultiplier is not equal to the sum of multipliers in all the incentivized pools.`,
				),
			);
		});

		it('Invalid poolId on tickId', () => {
			const genesisDEXData: GenesisDEX = {
				poolSubstore: [poolsStoreData],
				priceTickSubstore: [priceTicksStoreDataTickLower],
				positionSubstore: [],
				dexGlobalDataSubstore: {
					...dexGlobalStoreData,
					positionCounter: BigInt(0),
				},
			};

			const mockAssets = codec.encode(genesisDEXSchema, genesisDEXData);
			genesisBlockExecuteContext.assets.getAsset = () => mockAssets;
			expect(() => dexModule.verifyGenesisBlock(genesisBlockExecuteContext)).toThrow(
				Error(`Invalid poolId on tickId 0`),
			);
		});
	});
});
