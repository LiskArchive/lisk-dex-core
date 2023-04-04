/* eslint-disable import/no-cycle */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/member-ordering */
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
	utils,
	TokenMethod,
	ValidatorsMethod,
	FeeMethod,
} from 'lisk-sdk';

import { MODULE_ID_DEX, defaultConfig } from './constants';

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
import { AddLiquidityCommand } from './commands/addLiquidity';
import { CreatePositionCommand } from './commands/createPosition';

import { CollectFeesCommand } from './commands/collectFees';
import { RemoveLiquidityFailedEvent } from './events/removeLiquidityFailed';
import { RemoveLiquidityEvent } from './events/removeLiquidity';
import { RemoveLiquidityCommand } from './commands/removeLiquidity';

import {
	getAllPoolIdsResponseSchema,
	getToken1AmountRequestSchema,
	getToken1AmountResponseSchema,
	getToken0AmountRequestSchema,
	getToken0AmountResponseSchema,
	getFeeTierResponseSchema,
	getFeeTierRequestSchema,
	getPoolIDFromTickIDRequestSchema,
	getPoolIDFromTickIDResponseSchema,
	getPositionIndexRequestSchema,
	getPositionIndexResponseSchema,
	getAllTokenIdsResponseSchema,
	getAllPositionIDsInPoolRequestSchema,
	getAllPositionIDsInPoolResponseSchema,
	getPoolResponseSchema,
	getPoolRequestSchema,
	getCurrentSqrtPriceRequestSchema,
	getCurrentSqrtPriceResponseSchema,
	getDexGlobalDataResponseSchema,
	getPositionRequestSchema,
	getPositionResponseSchema,
	getTickWithTickIdRequestSchema,
	getTickWithTickIdResponseSchema,
	getTickWithPoolIdAndTickValueRequestSchema,
	getTickWithPoolIdAndTickValueResponseSchema,
	getLSKPriceRequestSchema,
	getLSKPriceResponseSchema,
	getTVLRequestSchema,
	getTVLResponseSchema,
	getAllTicksRequestSchema,
	getAllTicksResponseSchema,
	getAllTickIDsInPoolResponseSchema,
	getAllTickIDsInPoolRequestSchema,
	dryRunSwapExactOutRequestSchema,
	dryRunSwapExactOutResponseSchema,
	dryRunSwapExactInRequestSchema,
	dryRunSwapExactInResponseSchema,
	getCollectableFeesAndIncentivesRequestSchema,
	getCollectableFeesAndIncentivesResponseSchema,
} from './schemas';

import { SwappedEvent } from './events/swapped';
import { SwapFailedEvent } from './events/swapFailed';
import { dexGlobalStoreSchema, DexGlobalStore } from './stores/dexGlobalStore';
import { DexEndpoint } from './endpoint';
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
	public _feeMethod!: FeeMethod;
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
					request: getFeeTierRequestSchema,
					response: getFeeTierResponseSchema,
				},
				{
					name: this.endpoint.getPoolIDFromTickID.name,
					request: getPoolIDFromTickIDRequestSchema,
					response: getPoolIDFromTickIDResponseSchema,
				},
				{
					name: this.endpoint.getPositionIndex.name,
					request: getPositionIndexRequestSchema,
					response: getPositionIndexResponseSchema,
				},
				{
					name: this.endpoint.getAllTokenIDs.name,
					response: getAllTokenIdsResponseSchema,
				},
				{
					name: this.endpoint.getPool.name,
					request: getPoolRequestSchema,
					response: getPoolResponseSchema,
				},
				{
					name: this.endpoint.getCurrentSqrtPrice.name,
					request: getCurrentSqrtPriceRequestSchema,
					response: getCurrentSqrtPriceResponseSchema,
				},
				{
					name: this.endpoint.getDexGlobalData.name,
					response: getDexGlobalDataResponseSchema,
				},
				{
					name: this.endpoint.getPosition.name,
					request: getPositionRequestSchema,
					response: getPositionResponseSchema,
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
					name: this.endpoint.getAllPositionIDsInPool.name,
					request: getAllPositionIDsInPoolRequestSchema,
					response: getAllPositionIDsInPoolResponseSchema,
				},
				{
					name: this.endpoint.getCollectableFeesAndIncentives.name,
					request: getCollectableFeesAndIncentivesRequestSchema,
					response: getCollectableFeesAndIncentivesResponseSchema,
				},
				{
					name: this.endpoint.getAllTickIDsInPool.name,
					request: getAllTickIDsInPoolRequestSchema,
					response: getAllTickIDsInPoolResponseSchema,
				},
				{
					name: this.endpoint.dryRunSwapExactOut.name,
					request: dryRunSwapExactOutRequestSchema,
					response: dryRunSwapExactOutResponseSchema,
				},
				{
					name: this.endpoint.dryRunSwapExactIn.name,
					request: dryRunSwapExactInRequestSchema,
					response: dryRunSwapExactInResponseSchema,
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

	public addDependencies(
		tokenMethod: TokenMethod,
		validatorsMethod: ValidatorsMethod,
		feeMethod: FeeMethod,
	) {
		this._tokenMethod = tokenMethod;
		this._validatorsMethod = validatorsMethod;
		this._feeMethod = feeMethod;
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	public async init(args: ModuleInitArgs) {
		const { moduleConfig } = args;
		this._moduleConfig = utils.objects.mergeDeep({}, defaultConfig, moduleConfig) as ModuleConfig;

		this._createPoolCommand.init({
			moduleConfig: this._moduleConfig,
			tokenMethod: this._tokenMethod,
			feeMethod: this._feeMethod
		});
		this._addLiquidityCommand.init({
			tokenMethod: this._tokenMethod,
		});

		this._createPositionCommand.init({
			tokenMethod: this._tokenMethod,
			feeMethod: this._feeMethod
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
