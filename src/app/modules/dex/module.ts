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
} from 'lisk-sdk';

import {
	FeeTiers,
} from './types';

import {
	MODULE_ID_DEX,
	MODULE_NAME_DEX,
} from './constants';

export class DexModule extends BaseModule {
	public name = MODULE_NAME_DEX;
	public id = MODULE_ID_DEX;
	public endpoint;
	public api;
	private _feeTiers!: FeeTiers;

	// eslint-disable-next-line @typescript-eslint/member-ordering
	public commands = [];

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
	public async init() {
        this._feeTiers[100] = 2;
        this._feeTiers[500] = 10;
        this._feeTiers[3000] = 60;
        this._feeTiers[10000] = 200;
	}
}