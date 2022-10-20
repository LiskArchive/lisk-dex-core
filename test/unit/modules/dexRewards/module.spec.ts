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

import {
	createGenesisBlockContext,
	createBlockHeaderWithDefaults,
	createBlockContext,
} from '../../../../node_modules/lisk-framework/dist-node/testing';
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

	describe('afterTransactionsExecute', () => {
		const blockHeader = createBlockHeaderWithDefaults({ height: 101 });
		const blockAfterExecuteContext = createBlockContext({
			header: blockHeader,
		}).getBlockAfterExecuteContext();

		it(`should call mint for a valid bracket`, async () => {
			await dexRewardsModule.afterTransactionsExecute(blockAfterExecuteContext);
			expect(dexRewardsModule._tokenMethod.mint).toHaveBeenCalledTimes(100);
			expect(dexRewardsModule._tokenMethod.lock).toHaveBeenCalledTimes(100);
		});

		// it('should emit rewardMinted event for event type REWARD_NO_REDUCTION', async () => {
		// 	dexRewardsModule.method.getBlockReward = jest
		// 		.fn()
		// 		.mockReturnValue([BigInt(1), REWARD_NO_REDUCTION]);
		// 	await dexRewardsModule.afterTransactionsExecute(blockAfterExecuteContext);
		// 	expect(mint).toHaveBeenCalledTimes(1);
		// 	expect(blockAfterExecuteContext.eventQueue.getEvents()[0].toObject().name).toBe(
		// 		EVENT_REWARD_MINTED_DATA_NAME,
		// 	);
		// 	expect(blockAfterExecuteContext.eventQueue.getEvents()[0].toObject().module).toBe('reward');
		// });

		// it('should emit rewardMinted event for event type REWARD_REDUCTION_SEED_REVEAL', async () => {
		// 	dexRewardsModule.method.getBlockReward = jest
		// 		.fn()
		// 		.mockReturnValue([BigInt(0), REWARD_REDUCTION_SEED_REVEAL]);
		// 	await dexRewardsModule.afterTransactionsExecute(blockAfterExecuteContext);
		// 	expect(mint).toHaveBeenCalledTimes(0);
		// 	expect(blockAfterExecuteContext.eventQueue.getEvents()[0].toObject().name).toBe(
		// 		EVENT_REWARD_MINTED_DATA_NAME,
		// 	);
		// 	expect(blockAfterExecuteContext.eventQueue.getEvents()[0].toObject().module).toBe('reward');
		// });

		// it('should emit rewardMinted event for event type REWARD_REDUCTION_MAX_PREVOTES', async () => {
		// 	dexRewardsModule.method.getBlockReward = jest
		// 		.fn()
		// 		.mockReturnValue([
		// 			BigInt(1) / BigInt(REWARD_REDUCTION_FACTOR_BFT),
		// 			REWARD_REDUCTION_MAX_PREVOTES,
		// 		]);
		// 	expect(mint).toHaveBeenCalledTimes(0);
		// 	await dexRewardsModule.afterTransactionsExecute(blockAfterExecuteContext);
		// 	expect(blockAfterExecuteContext.eventQueue.getEvents()[0].toObject().name).toBe(
		// 		EVENT_REWARD_MINTED_DATA_NAME,
		// 	);
		// 	expect(blockAfterExecuteContext.eventQueue.getEvents()[0].toObject().module).toBe('reward');
		// });
	});
});
