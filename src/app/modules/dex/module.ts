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

import { BaseModule, ModuleMetadata, utils, TokenMethod, ValidatorsMethod } from 'lisk-sdk';

import {
	MODULE_ID_DEX,
	MODULE_NAME_DEX,
	defaultConfig
} from './constants';

import {
	DexEndpoint
} from './endpoint';
import {
	ModuleConfig,
	ModuleInitArgs
} from './types';

import {
	AmountBelowMinEvent,
	FeesIncentivesCollectedEvent,
	PoolCreatedEvent,
	PoolCreationFailedEvent,
	PositionCreatedEvent,
	PositionCreationFailedEvent,
} from './events';

import { CreatePoolCommand } from './commands/createPool';
import { AddLiquidityCommand } from './commands/addLiquidity';
import { PoolsStore, PositionsStore, PriceTicksStore, SettingsStore } from './stores';
import { DexMethod } from './method';
import { DexGlobalStore } from './stores/dexGlobalStore';

export class DexModule extends BaseModule {
	public id = MODULE_ID_DEX;
	public endpoint = new DexEndpoint(this.stores, this.offchainStores);
	public method = new DexMethod(this.stores, this.events);
	public _tokenMethod!: TokenMethod;
	public _validatorsMethod!: ValidatorsMethod;
	public _moduleConfig!: ModuleConfig;

	// eslint-disable-next-line @typescript-eslint/member-ordering
	private readonly _createPoolCommand = new CreatePoolCommand(this.stores, this.events)
	private readonly _addLiquidityCommand = new AddLiquidityCommand(this.stores, this.events)

	// eslint-disable-next-line @typescript-eslint/member-ordering
	public commands = [this._createPoolCommand, this._addLiquidityCommand];

	public constructor() {
		super();
		this.stores.register(DexGlobalStore, new DexGlobalStore(this.name));
		this.stores.register(PoolsStore, new PoolsStore(this.name));
		this.stores.register(PositionsStore, new PositionsStore(this.name));
		this.stores.register(PriceTicksStore, new PriceTicksStore(this.name));
		this.stores.register(SettingsStore, new SettingsStore(this.name));
		this.events.register(PoolCreatedEvent, new PoolCreatedEvent(this.name));
		this.events.register(PoolCreationFailedEvent, new PoolCreationFailedEvent(this.name));
		this.events.register(PositionCreatedEvent, new PositionCreatedEvent(this.name));
		this.events.register(PositionCreationFailedEvent, new PositionCreationFailedEvent(this.name));
		this.events.register(AmountBelowMinEvent, new AmountBelowMinEvent(this.name));
		this.events.register(FeesIncentivesCollectedEvent, new FeesIncentivesCollectedEvent(this.name));
	}

	public metadata(): ModuleMetadata {
		return {
			stores: [],
			endpoints: [],
			commands: [],
			events: [],
			assets: [],
		};
	}

	public addDependencies(tokenMethod: TokenMethod, validatorsMethod: ValidatorsMethod) {
		this._tokenMethod = tokenMethod;
		this._validatorsMethod = validatorsMethod;
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	public async init(args: ModuleInitArgs) {
		const {
			moduleConfig
		} = args;
		this._moduleConfig = utils.objects.mergeDeep({}, defaultConfig, moduleConfig) as ModuleConfig;

		this._createPoolCommand.init({
			moduleConfig: this._moduleConfig,
			tokenMethod: this._tokenMethod
		});
		this._addLiquidityCommand.init({
			tokenMethod: this._tokenMethod
		});
	}
}