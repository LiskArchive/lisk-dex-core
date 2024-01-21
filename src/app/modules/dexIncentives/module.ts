/* eslint-disable @typescript-eslint/member-ordering */
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

import {
	BaseCommand,
	BaseModule,
	BlockAfterExecuteContext,
	FeeMethod,
	ModuleMetadata,
	RandomMethod,
	TokenMethod,
	ValidatorsMethod,
	PoSMethod,
} from 'lisk-sdk';
import {
	ADDRESS_LIQUIDITY_PROVIDER_INCENTIVES,
	MODULE_NAME_DEX,
	TOKEN_ID_DEX_NATIVE,
} from './constants';

import { DexIncentivesEndpoint } from './endpoint';
import { ValidatorIncentivesPayout } from './events';

import { DexIncentivesMethod } from './method';
import {
	transferAllValidatorLSKIncentives,
	getLiquidityIncentivesAtHeight,
} from './utils/auxiliaryFunctions';

export class DexIncentivesModule extends BaseModule {
	public endpoint = new DexIncentivesEndpoint(this.stores, this.offchainStores);
	public method = new DexIncentivesMethod(this.stores, this.events);
	public _tokenMethod!: TokenMethod;
	public _randomMethod!: RandomMethod;
	public _validatorsMethod!: ValidatorsMethod;
	public _feeMethod!: FeeMethod;
	public _posMethod!: PoSMethod;

	public commands = [];

	public constructor() {
		super();
		this.events.register(ValidatorIncentivesPayout, new ValidatorIncentivesPayout(this.name));
	}

	public metadata(): ModuleMetadata {
		return {
			stores: [],
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

	public addDependencies(
		tokenMethod: TokenMethod,
		validatorsMethod: ValidatorsMethod,
		randomMethod: RandomMethod,
		feeMethod: FeeMethod,
		posMethod: PoSMethod,
	) {
		this._tokenMethod = tokenMethod;
		this._validatorsMethod = validatorsMethod;
		this._randomMethod = randomMethod;
		this._feeMethod = feeMethod;
		this._posMethod = posMethod;
	}

	public async afterTransactionsExecute(context: BlockAfterExecuteContext): Promise<void> {
		const methodContext = context.getMethodContext();
		const { header } = context;

		const liquidityIncentive = getLiquidityIncentivesAtHeight(context.header.height);

		await this._tokenMethod.mint(
			methodContext,
			ADDRESS_LIQUIDITY_PROVIDER_INCENTIVES,
			TOKEN_ID_DEX_NATIVE,
			liquidityIncentive,
		);
		await this._tokenMethod.lock(
			methodContext,
			ADDRESS_LIQUIDITY_PROVIDER_INCENTIVES,
			MODULE_NAME_DEX,
			TOKEN_ID_DEX_NATIVE,
			liquidityIncentive,
		);

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
		const { validators } = await this._validatorsMethod.getValidatorsParams(methodContext);
		// // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		if (header.height % validators.length === 0) {
			await transferAllValidatorLSKIncentives(
				validators,
				methodContext,
				this._tokenMethod,
				this._posMethod,
				this.events,
			);
		}
	}
}
