/* eslint-disable @typescript-eslint/no-unsafe-argument */
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

import { BaseModule, RandomModule, TokenModule, ValidatorsModule } from 'lisk-sdk';

import { DexRewardsModule } from '../../../../src/app/modules/dexRewards/module';
import { DexRewardsEndpoint } from '../../../../src/app/modules/dexRewards/endpoint';

import { MODULE_NAME_DEX_REWARDS } from '../../../../src/app/modules/dexRewards/constants';

import {
	createGenesisBlockContext,
	createBlockHeaderWithDefaults,
	createBlockContext,
} from '../../../../node_modules/lisk-framework/dist-node/testing';
import { DexRewardsMethod } from '../../../../src/app/modules/dexRewards/method';

interface Validator {
	address: Buffer;
	bftWeight: bigint;
	generatorKey: Buffer;
	blsKey: Buffer;
}

describe('DexRewardsModule', () => {
	let dexRewardsModule: DexRewardsModule;
	let tokenModule: TokenModule;
	let validatorModule;
	let randomModule: RandomModule;

	beforeEach(() => {
		dexRewardsModule = new DexRewardsModule();
		tokenModule = new TokenModule();
		validatorModule = new ValidatorsModule();
		randomModule = new RandomModule();

		tokenModule.method.mint = jest.fn().mockImplementation(async () => Promise.resolve());
		tokenModule.method.lock = jest.fn().mockImplementation(async () => Promise.resolve());
		tokenModule.method.unlock = jest.fn().mockImplementation(async () => Promise.resolve());
		tokenModule.method.transfer = jest.fn().mockImplementation(async () => Promise.resolve());
		tokenModule.method.getLockedAmount = jest.fn().mockResolvedValue(BigInt(1000));
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

		dexRewardsModule.addDependencies(
			tokenModule.method,
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
			validatorModule.method,
			randomModule.method,
		);
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
		// eslint-disable-next-line @typescript-eslint/require-await
		it('should setup initial state', async () => {
			const context = createGenesisBlockContext({}).createInitGenesisStateContext();
			return expect(dexRewardsModule.initGenesisState?.(context)).toBeUndefined();
		});
	});

	describe('afterTransactionsExecute', () => {
		const blockHeader = createBlockHeaderWithDefaults({ height: 101 });
		const blockAfterExecuteContext = createBlockContext({
			header: blockHeader,
		}).getBlockAfterExecuteContext();

		it(`should call token methods and emit events`, async () => {
			await dexRewardsModule.afterTransactionsExecute(blockAfterExecuteContext);
			expect(dexRewardsModule._tokenMethod.mint).toHaveBeenCalledTimes(3);
			expect(dexRewardsModule._tokenMethod.lock).toHaveBeenCalledTimes(2);
			expect(dexRewardsModule._tokenMethod.unlock).toHaveBeenCalledTimes(1);
			expect(dexRewardsModule._tokenMethod.transfer).toHaveBeenCalledTimes(101);

			const events = blockAfterExecuteContext.eventQueue.getEvents();
			const validatorTradeRewardsPayoutEvents = events.filter(
				e => e.toObject().name === 'validatorTradeRewardsPayout',
			);
			expect(validatorTradeRewardsPayoutEvents).toHaveLength(101);

			const generatorRewardMintedEvents = events.filter(
				e => e.toObject().name === 'generatorRewardMinted',
			);
			expect(generatorRewardMintedEvents).toHaveLength(1);
		});
	});
});
