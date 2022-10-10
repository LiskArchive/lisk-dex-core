/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
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

import { MODULE_ID_DEX, defaultConfig } from './constants';

import { DexEndpoint } from './endpoint';
import { ModuleConfig, ModuleInitArgs } from './types';

import { AmountBelowMinEvent, PoolCreatedEvent, PoolCreationFailedEvent } from './events';

import { CreatePoolCommand } from './commands/createPool';
import { PoolsStore, PositionsStore, PriceTicksStore, SettingsStore } from './stores';
import { DexMethod } from './method';
import { DexGlobalStore } from './stores/dexGlobalStore';

export class DexModule extends BaseModule {
	public id = MODULE_ID_DEX;
	public endpoint = new DexEndpoint(this.stores, this.offchainStores);
	public method = new DexMethod(this.stores, this.events);
	public _tokenMethod = new TokenMethod(this.stores, this.events, this.name);
	public _validatorsMethod = new ValidatorsMethod(this.stores, this.events);
	public _moduleConfig!: ModuleConfig;

	private readonly _createPoolCommand = new CreatePoolCommand(this.stores, this.events);

	// eslint-disable-next-line @typescript-eslint/member-ordering
	public commands = [this._createPoolCommand];

	public constructor() {
		super();
		this.stores.register(DexGlobalStore, new DexGlobalStore(this.name));
		this.stores.register(PoolsStore, new PoolsStore(this.name));
		this.stores.register(PositionsStore, new PositionsStore(this.name));
		this.stores.register(PriceTicksStore, new PriceTicksStore(this.name));
		this.stores.register(SettingsStore, new SettingsStore(this.name));
		this.events.register(PoolCreatedEvent, new PoolCreatedEvent(this.name));
		this.events.register(PoolCreationFailedEvent, new PoolCreationFailedEvent(this.name));
		this.events.register(AmountBelowMinEvent, new AmountBelowMinEvent(this.name));
	}

	public metadata(): ModuleMetadata {
		return {
			name: this.name,
			endpoints: [],
			commands: this.commands.map(command => ({
				name: command.name,
				params: command.schema,
			})),
			events: this.events.values().map(v => ({
				name: v.name,
				data: v.schema,
			})),
			assets: [],
		};
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	public async init(args: ModuleInitArgs) {
		const { moduleConfig } = args;
		this._moduleConfig = utils.objects.mergeDeep({}, defaultConfig, moduleConfig) as ModuleConfig;

		this._createPoolCommand.init({
			moduleConfig: this._moduleConfig,
			tokenMethod: this._tokenMethod,
		});
	}
}
