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

import { BaseEvent } from 'lisk-sdk';
import { DexModule } from '../../../../src/app/modules';
import { SwappedEvent } from '../../../../src/app/modules/dex/events/swapped';


describe('DexModule:events', () => {
	let dexModule: DexModule;

	beforeAll(() => {
		dexModule = new DexModule();
	});

	it('events should be registered and inherit from BaseEvent', () => {
		expect(dexModule.events.get(SwappedEvent)).toBeInstanceOf(BaseEvent);
	});
});
