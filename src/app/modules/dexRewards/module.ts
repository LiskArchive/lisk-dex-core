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
	BaseCommand,
	BaseModule,
	BlockAfterExecuteContext,
	ModuleMetadata,
	RandomMethod,
	TokenMethod,
	ValidatorsMethod,
} from 'lisk-sdk';
import {
	ADDRESS_LIQUIDITY_PROVIDER_REWARDS_POOL,
	ADDRESS_TRADER_REWARDS_POOL,
	BLOCK_REWARD_LIQUIDITY_PROVIDERS,
	BLOCK_REWARD_TRADERS,
	MODULE_NAME_DEX,
	TOKEN_ID_DEX_NATIVE,
} from './constants';

import { DexRewardsEndpoint } from './endpoint';
import { GeneratorRewardMintedEvent, ValidatorTradeRewardsPayoutEvent } from './events';

import { DexRewardsMethod } from './method';
import { getValidatorBlockReward, transferValidatorLSKRewards } from './utils/auxiliaryFunctions';

export class DexRewardsModule extends BaseModule {
	public endpoint = new DexRewardsEndpoint(this.stores, this.offchainStores);
	public method = new DexRewardsMethod(this.stores, this.events);
	public _tokenMethod!: TokenMethod;
	public _randomMethod!: RandomMethod;
	public _validatorsMethod!: ValidatorsMethod;

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

	public addDependencies(
		tokenMethod: TokenMethod,
		validatorsMethod: ValidatorsMethod,
		randomMethod: RandomMethod,
	) {
		this._tokenMethod = tokenMethod;
		this._validatorsMethod = validatorsMethod;
		this._randomMethod = randomMethod;
	}

	public async afterTransactionsExecute(context: BlockAfterExecuteContext): Promise<void> {
		const methodContext = context.getMethodContext();
		const { header } = context;
		const [blockReward, reduction] = await getValidatorBlockReward(
			methodContext,
			this._randomMethod,
			header,
			context.header.impliesMaxPrevotes,
		);

		if (blockReward > 0) {
			await this._tokenMethod.mint(
				methodContext,
				header.generatorAddress,
				TOKEN_ID_DEX_NATIVE,
				blockReward,
			);
		}
		this.events.get(GeneratorRewardMintedEvent).add(
			methodContext,
			{
				amount: blockReward,
				reduction,
				generatorAddress: header.generatorAddress,
			},
			[header.generatorAddress],
		);

		await this._tokenMethod.mint(
			methodContext,
			ADDRESS_LIQUIDITY_PROVIDER_REWARDS_POOL,
			TOKEN_ID_DEX_NATIVE,
			BLOCK_REWARD_LIQUIDITY_PROVIDERS,
		);
		await this._tokenMethod.lock(
			methodContext,
			ADDRESS_LIQUIDITY_PROVIDER_REWARDS_POOL,
			MODULE_NAME_DEX,
			TOKEN_ID_DEX_NATIVE,
			BLOCK_REWARD_LIQUIDITY_PROVIDERS,
		);
		await this._tokenMethod.mint(
			methodContext,
			ADDRESS_TRADER_REWARDS_POOL,
			TOKEN_ID_DEX_NATIVE,
			BLOCK_REWARD_TRADERS,
		);
		await this._tokenMethod.lock(
			methodContext,
			ADDRESS_TRADER_REWARDS_POOL,
			MODULE_NAME_DEX,
			TOKEN_ID_DEX_NATIVE,
			BLOCK_REWARD_TRADERS,
		);

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
		const { validators } = await this._validatorsMethod.getValidatorsParams(methodContext);
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		if (header.height % validators.length === 0) {
			await transferValidatorLSKRewards(validators, methodContext, this._tokenMethod, this.events);
		}
	}
}
