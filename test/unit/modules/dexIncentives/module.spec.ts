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

import { BaseModule, FeeModule, RandomModule, TokenModule, ValidatorsModule } from 'lisk-sdk';

import { DexIncentivesModule } from '../../../../src/app/modules/dexIncentives/module';
import { DexIncentivesEndpoint } from '../../../../src/app/modules/dexIncentives/endpoint';

import { MODULE_NAME_DEX_INCENTIVES } from '../../../../src/app/modules/dexIncentives/constants';

import {
	createGenesisBlockContext,
	createBlockHeaderWithDefaults,
	createBlockContext,
} from 'lisk-framework/dist-node/testing';
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
	let validatorModule;
	let randomModule: RandomModule;
	let feeModule: FeeModule;

	beforeEach(() => {
		dexIncentivesModule = new DexIncentivesModule();
		tokenModule = new TokenModule();
		validatorModule = new ValidatorsModule();
		randomModule = new RandomModule();
		feeModule = new FeeModule();

		tokenModule.method.mint = jest.fn().mockImplementation(async () => Promise.resolve());
		tokenModule.method.lock = jest.fn().mockImplementation(async () => Promise.resolve());
		tokenModule.method.unlock = jest.fn().mockImplementation(async () => Promise.resolve());
		tokenModule.method.transfer = jest.fn().mockImplementation(async () => Promise.resolve());
		tokenModule.method.getLockedAmount = jest.fn().mockResolvedValue(BigInt(1000));
		feeModule.method.payFee = jest.fn().mockResolvedValue(BigInt(100));
		randomModule.method.isSeedRevealValid = jest
			.fn()
			.mockImplementation(async () => Promise.resolve(true));

		const sampleValidator: Validator = {
			address: Buffer.from([]),
			bftWeight: BigInt(0),
			generatorKey: Buffer.from([]),
			blsKey: Buffer.from([]),
		};

		validatorModule.method.getValidatorsParams = jest
			.fn()
			.mockResolvedValue({ validators: Array(101).fill(sampleValidator) });

		dexIncentivesModule.addDependencies(
			tokenModule.method,
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
			validatorModule.method,
			randomModule.method,
			feeModule.method
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
	});

	describe('initGenesisState', () => {
		// eslint-disable-next-line @typescript-eslint/require-await
		it('should setup initial state', async () => {
			const context = createGenesisBlockContext({}).createInitGenesisStateContext();
			return expect(dexIncentivesModule.initGenesisState?.(context)).toBeUndefined();
		});
	});

	describe('afterTransactionsExecute', () => {
		const blockHeader = createBlockHeaderWithDefaults({ height: 101 });
		const blockAfterExecuteContext = createBlockContext({
			header: blockHeader,
		}).getBlockAfterExecuteContext();

		it(`should call token methods and emit events`, async () => {
			await dexIncentivesModule.afterTransactionsExecute(blockAfterExecuteContext);
			expect(dexIncentivesModule._tokenMethod.mint).toHaveBeenCalledTimes(3);
			expect(dexIncentivesModule._tokenMethod.lock).toHaveBeenCalledTimes(2);
			expect(dexIncentivesModule._tokenMethod.unlock).toHaveBeenCalledTimes(1);
			expect(dexIncentivesModule._tokenMethod.transfer).toHaveBeenCalledTimes(101);

			const events = blockAfterExecuteContext.eventQueue.getEvents();
			const validatorTradeIncentivesPayoutEvents = events.filter(
				e => e.toObject().name === 'validatorTradeIncentivesPayout',
			);
			expect(validatorTradeIncentivesPayoutEvents).toHaveLength(101);

			const generatorIncentiveMintedEvents = events.filter(
				e => e.toObject().name === 'generatorIncentiveMinted',
			);
			expect(generatorIncentiveMintedEvents).toHaveLength(1);
		});
	});
});
