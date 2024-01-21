/* eslint-disable import/no-cycle */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
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

import { MethodContext, PoSMethod, TokenMethod, testing } from 'lisk-framework';
import { createMethodContext, EventQueue } from 'lisk-framework/dist-node/state_machine';
import { PrefixedStateReadWriter } from '../../../stateMachine/prefixedStateReadWriter';

import { Address } from '../../../../src/app/modules/dex/types';
import { DexIncentivesModule } from '../../../../src/app/modules';
import {
	getLPIncentivesInRange,
	transferValidatorIncentives,
} from '../../../../src/app/modules/dexIncentives/utils/auxiliaryFunctions';
import {
	BOOTSTRAP_PERIOD_OFFSET,
	EVENT_NAME_VALIDATOR_INCENTIVES_PAYOUT,
} from '../../../../src/app/modules/dexIncentives/constants';

const { InMemoryPrefixedStateDB } = testing;

describe('dexIncentives:auxiliaryFunctions', () => {
	const senderAddress: Address = Buffer.from('0000000000000000', 'hex');
	const dexIncentivesModule = new DexIncentivesModule();
	const tokenMethod = new TokenMethod(
		dexIncentivesModule.stores,
		dexIncentivesModule.events,
		dexIncentivesModule.name,
	);
	const posMethod = new PoSMethod(dexIncentivesModule.stores, dexIncentivesModule.events);

	const stateStore = new PrefixedStateReadWriter(new InMemoryPrefixedStateDB());

	const methodContext: MethodContext = createMethodContext({
		contextStore: new Map(),
		stateStore,
		eventQueue: new EventQueue(0),
	});

	const transferMock = jest.fn();
	const lockMock = jest.fn();
	const unlockMock = jest.fn();
	const getAvailableBalanceMock = jest.fn().mockReturnValue(BigInt(250));
	const getLockedAmountMock = jest.fn().mockReturnValue(BigInt(5));

	describe('constructor', () => {
		beforeEach(() => {
			tokenMethod.transfer = transferMock;
			tokenMethod.lock = lockMock;
			tokenMethod.unlock = unlockMock;
			tokenMethod.getAvailableBalance = getAvailableBalanceMock.mockReturnValue(BigInt(250));
			tokenMethod.getLockedAmount = getLockedAmountMock.mockReturnValue(BigInt(5));
			posMethod.updateSharedRewards = jest.fn();
			dexIncentivesModule._tokenMethod = tokenMethod;
			dexIncentivesModule._posMethod = posMethod;
		});

		it('transferValidatorIncentives', async () => {
			await transferValidatorIncentives(
				methodContext,
				tokenMethod,
				posMethod,
				senderAddress,
				BigInt(1),
				dexIncentivesModule.events,
			);
			expect(dexIncentivesModule._tokenMethod.transfer).toHaveBeenCalledTimes(1);

			const events = methodContext.eventQueue.getEvents();
			const validatorTradeIncentivesPayoutEvents = events.filter(
				e => e.toObject().name === EVENT_NAME_VALIDATOR_INCENTIVES_PAYOUT,
			);
			expect(validatorTradeIncentivesPayoutEvents).toHaveLength(1);
		});

		it('getLPIncentivesInRange', () => {
			expect(() => getLPIncentivesInRange(1, 0)).toThrow();
			expect(
				getLPIncentivesInRange(
					Number(BOOTSTRAP_PERIOD_OFFSET),
					Number(BOOTSTRAP_PERIOD_OFFSET) + 1,
				),
			).toBe(BigInt('400000000'));
		});
	});
});
