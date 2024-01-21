/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable import/no-cycle */
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
	BaseModule,
	ModuleMetadata,
	utils,
	TokenMethod,
	ValidatorsMethod,
	FeeMethod,
	GenesisBlockExecuteContext,
	codec,
	ModuleInitArgs,
} from 'lisk-sdk';
import { isDeepStrictEqual } from 'util';

import {
	MAX_TICK,
	MIN_TICK,
	MODULE_ID_DEX,
	NUM_BYTES_POOL_ID,
	NUM_BYTES_POSITION_ID,
	NUM_BYTES_TICK_ID,
	defaultConfig,
} from './constants';

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
import { PoolsStore, PositionsStore, PriceTicksStore } from './stores';
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
	genesisDEXSchema,
	dryRunSwapExactInRequestSchema,
	dryRunSwapExactInResponseSchema,
	dryRunSwapExactOutRequestSchema,
	dryRunSwapExactOutResponseSchema,
	getCollectableFeesAndIncentivesRequestSchema,
	getCollectableFeesAndIncentivesResponseSchema,
} from './schemas';

import { SwappedEvent } from './events/swapped';
import { SwapFailedEvent } from './events/swapFailed';
import { dexGlobalStoreSchema, DexGlobalStore } from './stores/dexGlobalStore';
import { DexEndpoint } from './endpoint';
import { poolsStoreSchema } from './stores/poolsStore';
import { positionsStoreSchema } from './stores/positionsStore';
import { bytesToTick, priceTicksStoreSchema } from './stores/priceTicksStore';
import { SwapExactWithPriceLimitCommand } from './commands/swapWithPriceLimit';
import { SwapExactOutCommand } from './commands/swapExactOut';
import { GenesisDEX, ModuleConfig } from './types';
import { SwapExactInCommand } from './commands/swapExactIn';

function intToBuffer(input: number, bufferSize: number): Buffer {
	const outputBuffer = Buffer.alloc(bufferSize);
	outputBuffer.writeInt8(input, 0);
	return outputBuffer;
}

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
	private readonly _swapExactInCommand = new SwapExactInCommand(this.stores, this.events);
	private readonly _swapExactOutCommand = new SwapExactOutCommand(this.stores, this.events);

	// eslint-disable-next-line @typescript-eslint/member-ordering
	public commands = [
		this._createPoolCommand,
		this._collectFeeCommand,
		this._removeLiquidityCommand,
		this._addLiquidityCommand,
		this._createPositionCommand,
		this._swapExactWithPriceLimitCommand,
		this._swapExactInCommand,
		this._swapExactOutCommand,
	];

	public constructor() {
		super();
		this.stores.register(DexGlobalStore, new DexGlobalStore(this.name, 0));
		this.stores.register(PoolsStore, new PoolsStore(this.name, 1));
		this.stores.register(PositionsStore, new PositionsStore(this.name, 2));
		this.stores.register(PriceTicksStore, new PriceTicksStore(this.name, 3));
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
			feeMethod: this._feeMethod,
		});
		this._addLiquidityCommand.init({
			tokenMethod: this._tokenMethod,
		});

		this._createPositionCommand.init({
			tokenMethod: this._tokenMethod,
			feeMethod: this._feeMethod,
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
		this._swapExactInCommand.init({
			tokenMethod: this._tokenMethod,
		});
		this._swapExactOutCommand.init({
			tokenMethod: this._tokenMethod,
		});
	}

	public verifyGenesisBlock(context: GenesisBlockExecuteContext) {
		const assetBytes = context.assets.getAsset(this.name);
		if (!assetBytes) {
			return;
		}
		const genesisData = codec.decode<GenesisDEX>(genesisDEXSchema, assetBytes);
		const { poolSubstore, positionSubstore, priceTickSubstore, dexGlobalDataSubstore } =
			genesisData;

		function hasDuplicateParams(input, param: string) {
			const paramValues = input.map(i => i[param] as unknown);
			return paramValues.length !== new Set(paramValues).size;
		}

		if (
			genesisData.dexGlobalDataSubstore.positionCounter !==
			BigInt(genesisData.positionSubstore.length)
		) {
			throw new Error('Incorrect position counter.');
		}

		if (hasDuplicateParams(poolSubstore, 'poolId')) {
			throw new Error('Duplicate poolId in poolSubstore.');
		}

		if (hasDuplicateParams(priceTickSubstore, 'tickId')) {
			throw new Error('Duplicate tickId.');
		}

		if (hasDuplicateParams(positionSubstore, 'positionId')) {
			throw new Error('Duplicate positionId.');
		}

		if (hasDuplicateParams(dexGlobalDataSubstore.incentivizedPools, 'poolId')) {
			throw new Error('Duplicate poolId in incentivizedPools.');
		}

		// eslint-disable-next-line @typescript-eslint/unbound-method, @typescript-eslint/require-array-sort-compare
		const sortedIncentivizedPools = dexGlobalDataSubstore.incentivizedPools
			.map(e => e.poolId)
			.sort();

		if (
			!isDeepStrictEqual(
				sortedIncentivizedPools,
				dexGlobalDataSubstore.incentivizedPools.map(e => e.poolId),
			)
		) {
			throw new Error(
				'Entries in stateStore.incentivizedPools must be sorted with respect to poolId in ascending order.',
			);
		}

		for (const position of positionSubstore) {
			if (
				position.tickLower < MIN_TICK ||
				position.tickUpper > MAX_TICK ||
				position.tickLower > position.tickUpper
			) {
				throw new Error('Invalid tick values in positionSubstore');
			}
		}

		for (const [tickId] of priceTickSubstore.entries()) {
			const poolId = intToBuffer(tickId, 4).slice(0, NUM_BYTES_POOL_ID);
			if (!poolSubstore[Number(poolId)]) {
				throw new Error(`Invalid poolId on tickId ${tickId}`);
			}
		}

		for (const [positionId] of positionSubstore.entries()) {
			const poolId = intToBuffer(positionId, 4).slice(0, NUM_BYTES_POOL_ID);
			if (!poolSubstore[Number(poolId)]) {
				throw new Error(`Invalid poolId on tickId ${positionId}`);
			}
		}

		for (const pool of dexGlobalDataSubstore.incentivizedPools) {
			if (!poolSubstore[Number(pool.poolId)]) {
				// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
				throw new Error(`Invalid poolId on incentivizedPool ${pool.poolId}`);
			}
		}

		for (const [tickId, _] of priceTickSubstore.entries()) {
			const tickValueBytes = intToBuffer(tickId, 4).slice(-4);
			const tickValue = bytesToTick(tickValueBytes);
			const poolId = intToBuffer(tickId, 4).slice(0, NUM_BYTES_POOL_ID);
			const pool = poolSubstore[Number(poolId)];
			if (tickValue % pool.tickSpacing !== 0) {
				throw new Error(`Invalid tickValue for selected tickSpacing on tickId ${tickId}`);
			}
		}

		for (const [positionId, position] of positionSubstore.entries()) {
			const poolId = intToBuffer(positionId, 4).slice(0, NUM_BYTES_POOL_ID);
			const pool = poolSubstore[Number(poolId)];
			if (
				position.tickLower % pool.tickSpacing !== 0 ||
				position.tickUpper % pool.tickSpacing !== 0
			) {
				throw new Error(`Wrong tickSpacing on ${positionId}`);
			}
		}

		for (const [tickId, _] of priceTickSubstore.entries()) {
			const tickValueBytes = intToBuffer(tickId, 4).slice(-4);
			const tickValue = bytesToTick(tickValueBytes);
			const position = positionSubstore.find(
				e => e.tickLower === tickValue || e.tickUpper === tickValue,
			);
			if (!position) {
				throw new Error(`Could not find position where tickLower or tickUpper is ${tickValue}`);
			}
		}

		for (const [positionId, position] of positionSubstore.entries()) {
			const poolId = intToBuffer(positionId, 4).slice(0, NUM_BYTES_POOL_ID);
			const priceTickLower = Number(Buffer.concat([poolId, intToBuffer(position.tickLower, 4)]));
			const priceTickUpper = Number(Buffer.concat([poolId, intToBuffer(position.tickUpper, 4)]));

			if (position.tickLower !== priceTickLower || position.tickUpper !== priceTickUpper) {
				throw new Error(`Missing price ticks for ${priceTickLower} or ${priceTickUpper} not found`);
			}
		}

		for (const [_, { feeTier }] of dexGlobalDataSubstore.poolCreationSettings.entries()) {
			if (feeTier > 10 ** 6) {
				// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
				throw new Error(`Invalid fee tier ${feeTier}`);
			}
		}

		const totalIncentivizedPoolMultiplier = dexGlobalDataSubstore.incentivizedPools
			.map(({ multiplier }) => multiplier)
			.reduce((e, acc) => acc + e);

		if (dexGlobalDataSubstore.totalIncentivesMultiplier !== totalIncentivizedPoolMultiplier) {
			throw new Error(
				'totalIncentivesMultiplier is not equal to the sum of multipliers in all the incentivized pools.',
			);
		}
	}

	public async initGenesisState(context: GenesisBlockExecuteContext): Promise<void> {
		const assetBytes = context.assets.getAsset('dex');
		if (!assetBytes) {
			return;
		}
		const genesisStore = codec.decode<GenesisDEX>(genesisDEXSchema, assetBytes);
		const { dexGlobalDataSubstore } = genesisStore;
		const poolSubstoreData = genesisStore.poolSubstore;
		const priceTickSubstoreData = genesisStore.priceTickSubstore;
		const positionSubstoreData = genesisStore.positionSubstore;
		const poolsStore = this.stores.get(PoolsStore);
		const priceTicksStore = this.stores.get(PriceTicksStore);
		const positionsStore = this.stores.get(PositionsStore);
		const dexGlobalStore = this.stores.get(DexGlobalStore);

		for (const [poolId, pool] of poolSubstoreData.entries()) {
			await poolsStore.set(context, intToBuffer(poolId, NUM_BYTES_POOL_ID), {
				liquidity: pool.liquidity,
				sqrtPrice: pool.sqrtPrice,
				incentivesPerLiquidityAccumulator: pool.incentivesPerLiquidityAccumulator,
				heightIncentivesUpdate: pool.heightIncentivesUpdate,
				feeGrowthGlobal0: pool.feeGrowthGlobal0,
				feeGrowthGlobal1: pool.feeGrowthGlobal1,
				tickSpacing: pool.tickSpacing,
			});
		}

		for (const [priceTickId, priceTick] of priceTickSubstoreData.entries()) {
			await priceTicksStore.set(context, intToBuffer(priceTickId, NUM_BYTES_TICK_ID), {
				liquidityNet: priceTick.liquidityNet,
				liquidityGross: priceTick.liquidityGross,
				feeGrowthOutside0: priceTick.feeGrowthOutside0,
				feeGrowthOutside1: priceTick.feeGrowthOutside1,
				incentivesPerLiquidityOutside: priceTick.incentivesPerLiquidityOutside,
			});
		}

		for (const [positionId, position] of positionSubstoreData.entries()) {
			await positionsStore.set(context, intToBuffer(positionId, NUM_BYTES_POSITION_ID), {
				tickLower: position.tickLower,
				tickUpper: position.tickUpper,
				liquidity: position.liquidity,
				feeGrowthInsideLast0: position.feeGrowthInsideLast0,
				feeGrowthInsideLast1: position.feeGrowthInsideLast1,
				ownerAddress: position.ownerAddress,
				incentivesPerLiquidityLast: position.incentivesPerLiquidityLast,
			});
		}

		await dexGlobalStore.set(context, Buffer.alloc(0), {
			positionCounter: dexGlobalDataSubstore.positionCounter,
			poolCreationSettings: dexGlobalDataSubstore.poolCreationSettings.map(setting => ({
				feeTier: setting.feeTier,
				tickSpacing: setting.tickSpacing,
			})),
			incentivizedPools: dexGlobalDataSubstore.incentivizedPools.map(({ poolId, multiplier }) => ({
				poolId,
				multiplier,
			})),
			totalIncentivesMultiplier: dexGlobalDataSubstore.totalIncentivesMultiplier,
		});
	}
}
