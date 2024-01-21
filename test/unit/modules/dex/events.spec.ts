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
import { DexModule } from '../../../../src/app/modules';
import {
	SwappedEvent,
	SwapFailedEvent,
	PoolCreatedEvent,
	PoolCreationFailedEvent,
	PositionCreatedEvent,
	PositionCreationFailedEvent,
	PositionUpdateFailedEvent,
	PositionUpdatedEvent,
	RemoveLiquidityEvent,
	RemoveLiquidityFailedEvent,
} from '../../../../src/app/modules/dex/events';

describe('DexModule:events', () => {
	let dexModule: DexModule;

	beforeAll(() => {
		dexModule = new DexModule();
	});

	it('events should be registered and inherit from BaseEvent', () => {
		expect(dexModule.events.get(SwapFailedEvent)).toBeInstanceOf(BaseEvent);
		expect(dexModule.events.get(SwappedEvent)).toBeInstanceOf(BaseEvent);
		expect(dexModule.events.get(PoolCreatedEvent)).toBeInstanceOf(BaseEvent);
		expect(dexModule.events.get(PoolCreationFailedEvent)).toBeInstanceOf(BaseEvent);
		expect(dexModule.events.get(PositionCreatedEvent)).toBeInstanceOf(BaseEvent);
		expect(dexModule.events.get(PositionCreationFailedEvent)).toBeInstanceOf(BaseEvent);
		expect(dexModule.events.get(PositionUpdatedEvent)).toBeInstanceOf(BaseEvent);
		expect(dexModule.events.get(PositionUpdateFailedEvent)).toBeInstanceOf(BaseEvent);
		expect(dexModule.events.get(RemoveLiquidityEvent)).toBeInstanceOf(BaseEvent);
		expect(dexModule.events.get(RemoveLiquidityFailedEvent)).toBeInstanceOf(BaseEvent);
	});
});
