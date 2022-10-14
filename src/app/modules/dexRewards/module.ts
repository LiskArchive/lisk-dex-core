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

import { BaseCommand, BaseModule, ModuleMetadata, TokenMethod, ValidatorsMethod } from 'lisk-sdk';

import { DexRewardsEndpoint } from './endpoint';
import { GeneratorRewardMintedEvent, ValidatorTradeRewardsPayoutEvent } from './events';

import { DexRewardsMethod } from './method';

export class DexRewardsModule extends BaseModule {
	public endpoint = new DexRewardsEndpoint(this.stores, this.offchainStores);
	public method = new DexRewardsMethod(this.stores, this.events);
	public _tokenMethod = new TokenMethod(this.stores, this.events, this.name);
	public _validatorsMethod = new ValidatorsMethod(this.stores, this.events);

	public commands = [];

	public constructor() {
		super();
		this.events.register(
			ValidatorTradeRewardsPayoutEvent,
			new ValidatorTradeRewardsPayoutEvent(this.name),
		);
		this.events.register(GeneratorRewardMintedEvent, new GeneratorRewardMintedEvent(this.name));
	}

	public metadata(): ModuleMetadata {
		return {
			name: this.name,
			endpoints: [],
			commands: this.commands.map((command: BaseCommand) => ({
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
}
