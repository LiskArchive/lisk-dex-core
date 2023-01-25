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

import { BaseModule, ModuleMetadata, utils, TokenMethod, ValidatorsMethod, MethodContext } from 'lisk-sdk';

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
	PositionUpdatedEvent,
	PositionUpdateFailedEvent,
} from './events';

import { CreatePoolCommand } from './commands/createPool';
import { PoolsStore, PositionsStore, PriceTicksStore, SettingsStore } from './stores';
import { DexMethod } from './method';
import { DexGlobalStore, dexGlobalStoreSchema } from './stores/dexGlobalStore';
import { AddLiquidityCommand } from './commands/addLiquidity';
import { CreatePositionCommand } from './commands/createPosition';
import { CollectFeesCommand } from './commands/collectFees';
import { RemoveLiquidityCommand } from './commands/removeLiquidity';

import { RemoveLiquidityFailedEvent } from './events/removeLiquidityFailed';
import { RemoveLiquidityEvent } from './events/removeLiquidity';
import { poolsStoreSchema } from './stores/poolsStore';
import { positionsStoreSchema } from './stores/positionsStore';
import { priceTicksStoreSchema } from './stores/priceTicksStore';
import { settingsStoreSchema } from './stores/settingsStore';
import { SwapFailedEvent } from './events/swapFailed';

export class DexModule extends BaseModule {
	public id = MODULE_ID_DEX;
	public endpoint = new DexEndpoint(this.stores, this.offchainStores);
	public method = new DexMethod(this.stores, this.events);
	public _tokenMethod!: TokenMethod;
	public _validatorsMethod!: ValidatorsMethod;
	public _moduleConfig!: ModuleConfig;

	public _methodContext: MethodContext | undefined;

	private readonly _createPoolCommand = new CreatePoolCommand(this.stores, this.events);
	private readonly _addLiquidityCommand = new AddLiquidityCommand(this.stores, this.events);
	private readonly _createPositionCommand = new CreatePositionCommand(this.stores, this.events);
	private readonly _collectFeeCommand = new CollectFeesCommand(this.stores, this.events);
	private readonly _removeLiquidityCommand = new RemoveLiquidityCommand(this.stores, this.events);

	// eslint-disable-next-line @typescript-eslint/member-ordering
	public commands = [this._createPoolCommand, this._removeLiquidityCommand];

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
		this.events.register(PositionUpdatedEvent, new PositionUpdatedEvent(this.name));
		this.events.register(PositionUpdateFailedEvent, new PositionUpdateFailedEvent(this.name));
		this.events.register(AmountBelowMinEvent, new AmountBelowMinEvent(this.name));

		this.events.register(PositionCreatedEvent, new PositionCreatedEvent(DexModule.name));
		this.events.register(PoolCreatedEvent, new PoolCreatedEvent(DexModule.name));
		this.events.register(FeesIncentivesCollectedEvent, new FeesIncentivesCollectedEvent(DexModule.name));
		this.events.register(RemoveLiquidityFailedEvent, new RemoveLiquidityFailedEvent(DexModule.name));
		this.events.register(RemoveLiquidityEvent, new RemoveLiquidityEvent(DexModule.name));
	}

	public metadata(): ModuleMetadata {
		return {
			stores: [
				{
					key: 'DexGlobalStore',
					data: dexGlobalStoreSchema,
				},
				{
					key: 'PoolsStore',
					data: poolsStoreSchema,
				},
				{
					key: 'PositionsStore',
					data: positionsStoreSchema,
				},
				{
					key: 'PriceTicksStore',
					data: priceTicksStoreSchema,
				},
				{
					key: 'SettingsStore',
					data: settingsStoreSchema,
				},
			],
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
		this._createPositionCommand.init({
			tokenMethod: this._tokenMethod,
		});

		this._addLiquidityCommand.init({
			tokenMethod: this._tokenMethod,
		});

		this._removeLiquidityCommand.init({
			tokenMethod: this._tokenMethod
		})

	}
}