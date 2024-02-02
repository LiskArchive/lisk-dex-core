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
	PoSModule,
	RandomModule,
	TokenModule,
	ValidatorsModule,
} from 'lisk-sdk';

import { DexIncentivesModule } from '../../../../src/app/modules/dexIncentives/module';
import { DexIncentivesEndpoint } from '../../../../src/app/modules/dexIncentives/endpoint';

import { MODULE_NAME_DEX_INCENTIVES } from '../../../../src/app/modules/dexIncentives/constants';

import {
	createGenesisBlockContext,
	createBlockHeaderWithDefaults,
	createBlockContext,
} from '../../../../node_modules/lisk-framework/dist-node/testing';
import { DexIncentivesMethod } from '../../../../src/app/modules/dexIncentives/method';

interface Validator {
	address: Buffer;
	bftWeight: bigint;
	generatorKey: Buffer;
	blsKey: Buffer;
}

describe('DexIncentivesModule', () => {
	let dexIncentivesModule: DexIncentivesModule;
	let tokenModule: TokenModule;
	let validatorModule: ValidatorsModule;
	let randomModule: RandomModule;
	let feeModule: FeeModule;
	let posModule: PoSModule;

	beforeEach(() => {
		dexIncentivesModule = new DexIncentivesModule();
		tokenModule = new TokenModule();
		validatorModule = new ValidatorsModule();
		randomModule = new RandomModule();
		feeModule = new FeeModule();
		posModule = new PoSModule();

		tokenModule.method.mint = jest.fn().mockImplementation(async () => Promise.resolve());
		tokenModule.method.lock = jest.fn().mockImplementation(async () => Promise.resolve());
		tokenModule.method.unlock = jest.fn().mockImplementation(async () => Promise.resolve());
		tokenModule.method.transfer = jest.fn().mockImplementation(async () => Promise.resolve());
		tokenModule.method.getLockedAmount = jest.fn().mockResolvedValue(BigInt(1000));
		randomModule.method.isSeedRevealValid = jest
			.fn()
			.mockImplementation(async () => Promise.resolve(true));
		posModule.method.updateSharedRewards = jest.fn().mockImplementation(() => true);

		const sampleValidator: Validator = {
			address: Buffer.from([]),
			bftWeight: BigInt(5),
			generatorKey: Buffer.from([]),
			blsKey: Buffer.from([]),
		};

		validatorModule.method.getValidatorsParams = jest
			.fn()
			.mockResolvedValue({ validators: Array(101).fill(sampleValidator) });

		dexIncentivesModule.addDependencies(
			tokenModule.method,
			validatorModule.method,
			randomModule.method,
			feeModule.method,
			posModule.method,
		);
	});

	it('should inherit from BaseModule', () => {
		expect(DexIncentivesModule.prototype).toBeInstanceOf(BaseModule);
	});

	describe('constructor', () => {
		it('should have valid name', () => {
			expect(dexIncentivesModule.name).toBe(MODULE_NAME_DEX_INCENTIVES);
		});

		it('should expose endpoint', () => {
			expect(dexIncentivesModule).toHaveProperty('endpoint');
			expect(dexIncentivesModule.endpoint).toBeInstanceOf(DexIncentivesEndpoint);
		});

		it('should expose method', () => {
			expect(dexIncentivesModule).toHaveProperty('method');
			expect(dexIncentivesModule.method).toBeInstanceOf(DexIncentivesMethod);
		});

		it('should setup initial state', () => {
			const context = createGenesisBlockContext({}).createInitGenesisStateContext();
			return expect(dexIncentivesModule.initGenesisState?.(context)).toBeUndefined();
		});

		it(`should call token methods and emit events`, async () => {
			const blockHeader = createBlockHeaderWithDefaults({ height: 101 });
			const blockAfterExecuteContext = createBlockContext({
				header: blockHeader,
			}).getBlockAfterExecuteContext();

			await dexIncentivesModule.afterTransactionsExecute(blockAfterExecuteContext);
			expect(dexIncentivesModule._tokenMethod.mint).toHaveBeenCalledTimes(1);
			expect(dexIncentivesModule._tokenMethod.lock).toHaveBeenCalledTimes(2);
			expect(dexIncentivesModule._tokenMethod.unlock).toHaveBeenCalledTimes(1);
			expect(dexIncentivesModule._tokenMethod.transfer).toHaveBeenCalledTimes(101);

			const events = blockAfterExecuteContext.eventQueue.getEvents();
			const validatorTradeIncentivesPayoutEvents = events.filter(
				e => e.toObject().name === 'validatorTradeIncentivesPayout',
			);
			expect(validatorTradeIncentivesPayoutEvents).toHaveLength(0);

			const generatorIncentiveMintedEvents = events.filter(
				e => e.toObject().name === 'generatorIncentiveMinted',
			);
			expect(generatorIncentiveMintedEvents).toHaveLength(0);
		});
	});
});
