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

import { BaseEvent } from 'lisk-sdk';

import { DexIncentivesModule } from '../../../../src/app/modules/dexIncentives/module';

import { ValidatorIncentivesPayout } from '../../../../src/app/modules/dexIncentives/events';

describe('DexIncentivesModule:events', () => {
	let dexIncentivesModule: DexIncentivesModule;

	beforeAll(() => {
		dexIncentivesModule = new DexIncentivesModule();
	});

	it('events should be registered and inherit from BaseEvent', () => {
		expect(dexIncentivesModule.events.get(ValidatorIncentivesPayout)).toBeInstanceOf(BaseEvent);
	});
});
