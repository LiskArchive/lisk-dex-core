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
import { RemoveLiquidityFailedEvent } from './events/removeLiquidityFailed';
import { RemoveLiquidityEvent } from './events/removeLiquidity';
import { RemoveLiquidityCommand } from './commands/removeLiquidity';
import {
	getAllPoolIdsRequestSchema,
	getAllPoolIdsResponseSchema,
	getToken1AmountRequestSchema,
	getToken1AmountResponseSchema,
	getToken0AmountRequestSchema,
	getToken0AmountResponseSchema,
	getFeeTierResponseSchema,
	getFeeTierResquestSchema,
	getPoolIDFromTickIDRequestSchema,
	getPositionIndexResponseSchema,
	ggetPositionIndexResquestSchema,
	getAllTokenIdsRequestSchema,
	getAllTokenIdsResponseSchema,
	getAllPositionIDsInPoolRequestSchema,
	getAllPositionIDsInPoolResponseSchema,
	getCurrentSqrtPriceRequestSchema,
	getCurrentSqrtPriceResponseSchema,
	getDexGlobalDataRequestSchema,
	getDexGlobalDataResponseSchema,
	getPoolRequestSchema,
	getPoolResponseSchema,
	getTickWithPoolIdAndTickValueRequestSchema,
	getTickWithPoolIdAndTickValueResponseSchema,
	getTickWithTickIdRequestSchema,
	getTickWithTickIdResponseSchema,
	getLSKPriceRequestSchema,
	getLSKPriceResponseSchema,
	getTVLRequestSchema,
	getTVLResponseSchema,
	getAllTicksRequestSchema,
	getAllTicksResponseSchema,
	getAllTickIDsInPoolRequestSchema,
	getAllTickIDsInPoolRsponseSchema,
} from './schemas';
import { SwappedEvent } from './events/swapped';
import { SwapFailedEvent } from './events/swapFailed';
import { poolsStoreSchema } from './stores/poolsStore';
import { positionsStoreSchema } from './stores/positionsStore';
import { priceTicksStoreSchema } from './stores/priceTicksStore';
import { settingsStoreSchema } from './stores/settingsStore';
import { SwapExactWithPriceLimitCommand } from './commands/swapWithPriceLimit';
import { SwapExactOutCommand } from './commands/swapExactOut';

export class DexModule extends BaseModule {
	public id = MODULE_ID_DEX;
	public endpoint = new DexEndpoint(this.stores, this.offchainStores);
	public method = new DexMethod(this.stores, this.events);
	public _tokenMethod!: TokenMethod;
	public _validatorsMethod!: ValidatorsMethod;
	public _moduleConfig!: ModuleConfig;

	private readonly _createPoolCommand = new CreatePoolCommand(this.stores, this.events);
	private readonly _addLiquidityCommand = new AddLiquidityCommand(this.stores, this.events);
	private readonly _createPositionCommand = new CreatePositionCommand(this.stores, this.events);
	private readonly _collectFeeCommand = new CollectFeesCommand(this.stores, this.events);
	private readonly _removeLiquidityCommand = new RemoveLiquidityCommand(this.stores, this.events);
	private readonly _swapExactWithPriceLimitCommand = new SwapExactWithPriceLimitCommand(
		this.stores,
		this.events,
	);
	private readonly _swapExactOutCommand = new SwapExactOutCommand(this.stores, this.events);

	// eslint-disable-next-line @typescript-eslint/member-ordering
	public commands = [
		this._createPoolCommand,
		this._collectFeeCommand,
		this._removeLiquidityCommand,
		this._addLiquidityCommand,
		this._createPositionCommand,
		this._swapExactWithPriceLimitCommand,
		this._swapExactOutCommand,
	];

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
		this.events.register(FeesIncentivesCollectedEvent, new FeesIncentivesCollectedEvent(this.name));
		this.events.register(RemoveLiquidityEvent, new RemoveLiquidityEvent(this.name));
		this.events.register(RemoveLiquidityFailedEvent, new RemoveLiquidityFailedEvent(this.name));
		this.events.register(SwapFailedEvent, new SwapFailedEvent(this.name));
		this.events.register(SwappedEvent, new SwappedEvent(this.name));
	}

	public metadata(): ModuleMetadata {
		return {
			stores: [
				{ key: DexGlobalStore.name, data: dexGlobalStoreSchema },
				{ key: PoolsStore.name, data: poolsStoreSchema },
				{ key: PositionsStore.name, data: positionsStoreSchema },
				{ key: PriceTicksStore.name, data: priceTicksStoreSchema },
				{ key: SettingsStore.name, data: settingsStoreSchema },
			],
			endpoints: [
				{
					name: this.endpoint.getAllPoolIDs.name,
					request: getAllPoolIdsRequestSchema,
					response: getAllPoolIdsResponseSchema,
				},
				{
					name: this.endpoint.getToken1Amount.name,
					request: getToken1AmountRequestSchema,
					response: getToken1AmountResponseSchema,
				},
				{
					name: this.endpoint.getToken0Amount.name,
					request: getToken0AmountRequestSchema,
					response: getToken0AmountResponseSchema,
				},
				{
					name: this.endpoint.getFeeTier.name,
					request: getFeeTierResquestSchema,
					response: getFeeTierResponseSchema,
				},
				{
					name: this.endpoint.getPoolIDFromTickID.name,
					request: getPoolIDFromTickIDRequestSchema,
					response: getPoolIDFromTickIDRequestSchema,
				},
				{
					name: this.endpoint.getPositionIndex.name,
					request: ggetPositionIndexResquestSchema,
					response: getPositionIndexResponseSchema,
				},
				{
					name: this.endpoint.getAllTokenIDs.name,
					request: getAllTokenIdsRequestSchema,
					response: getAllTokenIdsResponseSchema,
				},
				{
					name: this.endpoint.getAllPositionIDsInPool.name,
					request: getAllPositionIDsInPoolRequestSchema,
					response: getAllPositionIDsInPoolResponseSchema,
				},
				{
					name: this.endpoint.getPool.name,
					request: getPoolResponseSchema,
					response: getPoolRequestSchema,
				},
				{
					name: this.endpoint.getCurrentSqrtPrice.name,
					request: getCurrentSqrtPriceRequestSchema,
					response: getCurrentSqrtPriceResponseSchema,
				},
				{
					name: this.endpoint.getDexGlobalData.name,
					request: getDexGlobalDataRequestSchema,
					response: getDexGlobalDataResponseSchema,
				},
				{
					name: this.endpoint.getPosition.name,
					request: getDexGlobalDataRequestSchema,
					response: getDexGlobalDataResponseSchema,
				},
				{
					name: this.endpoint.getTickWithTickId.name,
					request: getTickWithTickIdRequestSchema,
					response: getTickWithTickIdResponseSchema,
				},
				{
					name: this.endpoint.getTickWithPoolIdAndTickValue.name,
					request: getTickWithPoolIdAndTickValueRequestSchema,
					response: getTickWithPoolIdAndTickValueResponseSchema,
				},
				{
					name: this.endpoint.getLSKPrice.name,
					request: getLSKPriceRequestSchema,
					response: getLSKPriceResponseSchema,
				},
				{
					name: this.endpoint.getTVL.name,
					request: getTVLRequestSchema,
					response: getTVLResponseSchema,
				},
				{
					name: this.endpoint.getAllTicks.name,
					request: getAllTicksRequestSchema,
					response: getAllTicksResponseSchema,
				},
				{
					name: this.endpoint.getAllTickIDsInPool.name,
					request: getAllTickIDsInPoolRequestSchema,
					response: getAllTickIDsInPoolRsponseSchema,
				},
			],
			commands: this.commands.map(command => ({
				name: command.name,
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				params: command.schema,
			})),
			events: this.events.values().map(v => ({
				name: v.name,
				data: v.schema,
			})),
			assets: [],
		};
	}

	public addDependencies(tokenMethod: TokenMethod, validatorsMethod: ValidatorsMethod) {
		this._tokenMethod = tokenMethod;
		this._validatorsMethod = validatorsMethod;
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	public async init(args: ModuleInitArgs) {
		const { moduleConfig } = args;
		this._moduleConfig = utils.objects.mergeDeep({}, defaultConfig, moduleConfig) as ModuleConfig;

		this._createPoolCommand.init({
			moduleConfig: this._moduleConfig,
			tokenMethod: this._tokenMethod,
		});
		this._addLiquidityCommand.init({
			tokenMethod: this._tokenMethod,
		});

		this._createPositionCommand.init({
			tokenMethod: this._tokenMethod,
		});

		this._collectFeeCommand.init({
			tokenMethod: this._tokenMethod,
		});

		this._removeLiquidityCommand.init({
			tokenMethod: this._tokenMethod,
		});

		this._swapExactWithPriceLimitCommand.init({
			tokenMethod: this._tokenMethod,
		});
		this._swapExactOutCommand.init({
			tokenMethod: this._tokenMethod,
		});
	}
}
