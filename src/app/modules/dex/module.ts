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

import {
	BaseModule,
	ModuleMetadata,
	TokenAPI,
	ValidatorsAPI,
	utils
} from 'lisk-sdk';

import {
	MODULE_ID_DEX,
	MODULE_NAME_DEX,
	defaultConfig
} from './constants';

import {
	DexAPI
} from './api';
import {
	DexEndpoint
} from './endpoint';
import {
	ModuleConfig,
	ModuleInitArgs
} from './types';

export class DexModule extends BaseModule {
	public name = MODULE_NAME_DEX;
	public id = MODULE_ID_DEX;
	public endpoint = new DexEndpoint(this.id);
	public api = new DexAPI(this.id);
	public _tokenAPI!: TokenAPI;
	public _validatorsAPI!: ValidatorsAPI;
	public _moduleConfig!: ModuleConfig;

	// eslint-disable-next-line @typescript-eslint/member-ordering
	private readonly _createPoolCommand = new CreatePoolCommand(this.stores, this.events)
	private readonly _addLiquidityCommand = new AddLiquidityCommand(this.stores, this.events)

	// eslint-disable-next-line @typescript-eslint/member-ordering
	public commands = [this._createPoolCommand, this._addLiquidityCommand];

	public addDependencies(tokenAPI: TokenAPI, validatorsAPI: ValidatorsAPI) {
		this._tokenAPI = tokenAPI;
		this._validatorsAPI = validatorsAPI;
	}

	public metadata(): ModuleMetadata {
		return {
			id: this.id,
			name: this.name,
			endpoints: [],
			commands: [],
			events: [],
			assets: [],
		};
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