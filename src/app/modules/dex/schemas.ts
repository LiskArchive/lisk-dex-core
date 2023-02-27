/*
 * Copyright © 2021 Lisk Foundation
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
	MAX_NUM_BYTES_Q96,
	NUM_BYTES_ADDRESS,
	NUM_BYTES_POOL_ID,
	NUM_BYTES_POSITION_ID,
	NUM_BYTES_TICK_ID,
} from './constants';

export const settingsSchema = {
	$id: '/dex/settings',
	type: 'object',
	required: [
		'protocolFeeAddress',
		'protocolFeePart',
		'validatorsLSKRewardsPart',
		'poolCreationSettings',
	],
	properties: {
		protocolFeeAddress: {
			dataType: 'bytes',
			length: NUM_BYTES_ADDRESS,
			fieldNumber: 1,
		},
		protocolFeePart: {
			dataType: 'uint32',
			fieldNumber: 2,
		},
		validatorsLSKRewardsPart: {
			dataType: 'uint32',
			fieldNumber: 3,
		},
		poolCreationSettings: {
			type: 'array',
			fieldNumber: 4,
			items: {
				type: 'object',
				required: ['feeTier', 'tickSpacing'],
				properties: {
					feeTier: {
						dataType: 'uint32',
						fieldNumber: 1,
					},
					tickSpacing: {
						dataType: 'uint32',
						fieldNumber: 2,
					},
				},
			},
		},
	},
};

export const genesisDEXSchema = {
	$id: '/dex/genesis',
	type: 'object',
	required: [
		'stateSubstore',
		'poolSubstore',
		'priceTickSubstore',
		'positionSubstore',
		'settingsSubstore',
	],
	properties: {
		stateSubstore: {
			type: 'object',
			fieldNumber: 1,
			required: ['positionCounter', 'collectableLSKFees'],
			properties: {
				positionCounter: {
					dataType: 'uint64',
					fieldNumber: 1,
				},
				collectableLSKFees: {
					dataType: 'uint64',
					fieldNumber: 2,
				},
			},
		},
		poolSubstore: {
			type: 'array',
			fieldNumber: 2,
			items: {
				type: 'object',
				required: [
					'poolId',
					'liquidity',
					'sqrtPrice',
					'feeGrowthGlobal0',
					'feeGrowthGlobal1',
					'tickSpacing',
				],
				properties: {
					poolId: {
						dataType: 'bytes',
						length: NUM_BYTES_POOL_ID,
						fieldNumber: 1,
					},
					liquidity: {
						dataType: 'uint64',
						fieldNumber: 2,
					},
					sqrtPrice: {
						dataType: 'bytes',
						maxLength: MAX_NUM_BYTES_Q96,
						fieldNumber: 3,
					},
					feeGrowthGlobal0: {
						dataType: 'bytes',
						maxLength: MAX_NUM_BYTES_Q96,
						fieldNumber: 4,
					},
					feeGrowthGlobal1: {
						dataType: 'bytes',
						maxLength: MAX_NUM_BYTES_Q96,
						fieldNumber: 5,
					},
					tickSpacing: {
						dataType: 'uint32',
						fieldNumber: 6,
					},
				},
			},
		},
		priceTickSubstore: {
			type: 'array',
			fieldNumber: 3,
			items: {
				type: 'object',
				required: [
					'tickId',
					'liquidityNet',
					'liquidityGross',
					'feeGrowthOutside0',
					'feeGrowthOutside1',
				],
				properties: {
					tickId: {
						dataType: 'bytes',
						length: NUM_BYTES_TICK_ID,
						fieldNumber: 1,
					},
					liquidityNet: {
						dataType: 'sint64',
						fieldNumber: 2,
					},
					liquidityGross: {
						dataType: 'uint64',
						fieldNumber: 3,
					},
					feeGrowthOutside0: {
						dataType: 'bytes',
						maxLength: MAX_NUM_BYTES_Q96,
						fieldNumber: 4,
					},
					feeGrowthOutside1: {
						dataType: 'bytes',
						maxLength: MAX_NUM_BYTES_Q96,
						fieldNumber: 5,
					},
				},
			},
		},
		positionSubstore: {
			type: 'array',
			fieldNumber: 4,
			items: {
				type: 'object',
				required: [
					'positionId',
					'tickLower',
					'tickUpper',
					'liquidity',
					'feeGrowthInsideLast0',
					'feeGrowthInsideLast1',
				],
				properties: {
					positionId: {
						dataType: 'bytes',
						length: NUM_BYTES_POSITION_ID,
						fieldNumber: 1,
					},
					tickLower: {
						dataType: 'sint32',
						fieldNumber: 2,
					},
					tickUpper: {
						dataType: 'sint32',
						fieldNumber: 3,
					},
					liquidity: {
						dataType: 'uint64',
						fieldNumber: 4,
					},
					feeGrowthInsideLast0: {
						dataType: 'bytes',
						maxLength: MAX_NUM_BYTES_Q96,
						fieldNumber: 5,
					},
					feeGrowthInsideLast1: {
						dataType: 'bytes',
						maxLength: MAX_NUM_BYTES_Q96,
						fieldNumber: 6,
					},
					ownerAddress: {
						dataType: 'bytes',
						length: NUM_BYTES_ADDRESS,
						fieldNumber: 7,
					},
				},
			},
		},
		settingsSubstore: {
			type: 'object',
			fieldNumber: 5,
			required: [
				'protocolFeeAddress',
				'protocolFeePart',
				'validatorsLSKRewardsPart',
				'poolCreationSettings',
			],
			properties: {
				protocolFeeAddress: {
					dataType: 'bytes',
					length: NUM_BYTES_ADDRESS,
					fieldNumber: 1,
				},
				protocolFeePart: {
					dataType: 'uint32',
					fieldNumber: 2,
				},
				validatorsLSKRewardsPart: {
					dataType: 'uint32',
					fieldNumber: 3,
				},
				poolCreationSettings: {
					type: 'array',
					fieldNumber: 4,
					items: {
						type: 'object',
						required: ['feeTier', 'tickSpacing'],
						properties: {
							feeTier: {
								dataType: 'uint32',
								fieldNumber: 1,
							},
							tickSpacing: {
								dataType: 'uint32',
								fieldNumber: 2,
							},
						},
					},
				},
			},
		},
	},
};

export const createPoolSchema = {
	$id: '/dex/createPoolSchema',
	type: 'object',
	required: [
		'tokenID0',
		'tokenID1',
		'feeTier',
		'tickInitialPrice',
		'initialPosition',
		'maxTimestampValid',
	],
	properties: {
		tokenID0: {
			dataType: 'bytes',
			fieldNumber: 1,
		},
		tokenID1: {
			dataType: 'bytes',
			fieldNumber: 2,
		},
		feeTier: {
			dataType: 'uint32',
			fieldNumber: 3,
		},
		tickInitialPrice: {
			dataType: 'sint32',
			fieldNumber: 4,
		},
		initialPosition: {
			type: 'object',
			fieldNumber: 5,
			required: ['tickLower', 'tickUpper', 'amount0Desired', 'amount1Desired'],
			properties: {
				tickLower: {
					dataType: 'sint32',
					fieldNumber: 1,
				},
				tickUpper: {
					dataType: 'sint32',
					fieldNumber: 2,
				},
				amount0Desired: {
					dataType: 'uint64',
					fieldNumber: 3,
				},
				amount1Desired: {
					dataType: 'uint64',
					fieldNumber: 4,
				},
			},
		},
		maxTimestampValid: {
			dataType: 'uint64',
			fieldNumber: 6,
		},
	},
};

export const createPositionSchema = {
	$id: '/dex/createPositionSchema',
	type: 'object',
	required: [
		'poolID',
		'tickLower',
		'tickUpper',
		'amount0Desired',
		'amount1Desired',
		'amount0Min',
		'amount1Min',
		'maxTimestampValid',
	],
	properties: {
		poolID: {
			dataType: 'bytes',
			fieldNumber: 1,
		},
		tickLower: {
			dataType: 'sint32',
			fieldNumber: 2,
		},
		tickUpper: {
			dataType: 'sint32',
			fieldNumber: 3,
		},
		amount0Desired: {
			dataType: 'uint64',
			fieldNumber: 4,
		},
		amount1Desired: {
			dataType: 'uint64',
			fieldNumber: 5,
		},
		amount0Min: {
			dataType: 'uint64',
			fieldNumber: 6,
		},
		amount1Min: {
			dataType: 'uint64',
			fieldNumber: 7,
		},
		maxTimestampValid: {
			dataType: 'uint64',
			fieldNumber: 8,
		},
	},
};

export const collectFeesSchema = {
	$id: '/dex/collectFees',
	type: 'object',
	required: ['positions'],
	properties: {
		positions: {
			type: 'array',
			fieldNumber: 1,
			items: {
				type: 'object',
				required: ['positionID'],
				properties: {
					positionID: {
						dataType: 'bytes',
						fieldNumber: 1,
					},
				},
			},
		},
	},
};

export const removeLiquiditySchema = {
	$id: '/dex/removeLiquidity',
	type: 'object',
	required: ['positionID', 'liquidityToRemove', 'amount0Min', 'amount1Min', 'maxTimestampValid'],
	properties: {
		positionID: {
			dataType: 'bytes',
			fieldNumber: 1,
		},
		liquidityToRemove: {
			dataType: 'uint64',
			fieldNumber: 2,
		},
		amount0Min: {
			dataType: 'uint64',
			fieldNumber: 3,
		},
		amount1Min: {
			dataType: 'uint64',
			fieldNumber: 4,
		},
		maxTimestampValid: {
			dataType: 'uint64',
			fieldNumber: 5,
		},
	},
};

export const addLiquiditySchema = {
	$id: '/dex/addLiquiditySchema',
	type: 'object',
	required: [
		'positionID',
		'amount0Desired',
		'amount1Desired',
		'amount0Min',
		'amount1Min',
		'maxTimestampValid',
	],
	properties: {
		positionID: {
			dataType: 'bytes',
			fieldNumber: 1,
		},
		amount0Desired: {
			dataType: 'uint64',
			fieldNumber: 2,
		},
		amount1Desired: {
			dataType: 'uint64',
			fieldNumber: 3,
		},
		amount0Min: {
			dataType: 'uint64',
			fieldNumber: 4,
		},
		amount1Min: {
			dataType: 'uint64',
			fieldNumber: 5,
		},
		maxTimestampValid: {
			dataType: 'uint64',
			fieldNumber: 6,
		},
	},
};

export const getAllPoolIdsResponseSchema = {
	$id: 'dex/endpoint/getAllPoolIdsResponse',
	type: 'object',
	required: ['poolIDs'],
	properties: {
		poolIDs: {
			dataType: 'object',
			fieldNumber: 1,
		},
	},
};

export const getAllTokenIdsRequestSchema = {
	$id: 'dex/getAllTokenIds',
	type: 'object',
	required: ['stores'],
	properties: {
		stores: {
			dataType: 'object',
			fieldNumber: 1,
			poolIDArray: {
				type: 'array',
				fieldNumber: 1,
				items: {
					type: 'object',
					required: ['poolID'],
					properties: {
						poolID: {
							dataType: 'bytes',
							minLength: NUM_BYTES_POOL_ID,
							maxLength: NUM_BYTES_POOL_ID,
							fieldNumber: 1,
						},
					},
				},
			},
		},
	},
};

export const getAllTokenIdsResponseSchema = {
	$id: 'dex/endpoint/getAllTokenIdsResponse',
	type: 'object',
	required: ['tokens'],
	properties: {
		tokens: {
			type: 'set',
			fieldNumber: 1,
			items: {
				type: 'object',
				required: ['tokenID'],
				properties: {
					tokenID: {
						dataType: 'bytes',
						fieldNumber: 1,
					},
				},
			},
		},
	},
};

export const getAllPositionIDsInPoolRequestSchema = {
	$id: 'dex/endpoint/getAllPositionIDsInPoolRequest',
	type: 'object',
	required: ['poolID', 'positionIDsList'],
	properties: {
		poolID: {
			dataType: 'bytes',
			fieldNumber: 1,
		},
		positionIDsList: {
			type: 'array',
			fieldNumber: 2,
			items: {
				dataType: 'bytes',
			},
		},
	},
};

export const getAllPositionIDsInPoolResponseSchema = {
	$id: 'dex/endpoint/getAllPositionIDsInPoolResponse',
	type: 'object',
	required: ['positionIDsInPool'],
	properties: {
		positionIDsInPool: {
			type: 'array',
			fieldNumber: 1,
			items: {
				dataType: 'bytes',
				fieldNumber: 1,
			},
		},
	},
};

export const getCurrentSqrtPriceRequestSchema = {
	$id: 'dex/endpoint/getCurrentSqrtPriceRequest',
	type: 'object',
	required: ['poolID', 'priceDirection'],
	properties: {
		poolID: {
			dataType: 'bytes',
			fieldNumber: 1,
		},
		priceDirection: {
			dataType: 'boolean',
			fieldNumber: 2,
		},
	},
};

export const getCurrentSqrtPriceResponseSchema = {
	$id: 'dex/endpoint/getCurrentSqrtPriceResponse',
	type: 'object',
	required: ['currentSqrtPrice'],
	properties: {
		currentSqrtPrice: {
			dataType: 'uint64',
			fieldNumber: 1,
		},
	},
};

export const getPoolIDFromTickIDRequestSchema = {
	$id: 'dex/endpoint/getPoolIDFromTickIDRequest',
	required: ['tickID'],
	type: 'object',
	properties: {
		tickID: {
			type: 'object',
			fieldNumber: 1,
		},
	},
};

export const getDexGlobalDataResponseSchema = {
	$id: 'dex/endpoint/getDexGlobalDataResponse',
	type: 'object',
	required: ['poolID'],
	properties: {
		poolID: {
			type: 'object',
			fieldNumber: 1,
		},
	},
};

export const getPositionRequestSchema = {
	$id: 'dex/endpoint/getPositionRequest',
	type: 'object',
	required: ['positionID', 'positionIDsList'],
	properties: {
		positionID: {
			dataType: 'bytes',
			fieldNumber: 1,
		},
		positionIDsList: {
			type: 'array',
			fieldNumber: 2,
		},
	},
};

export const getPositionResponseSchema = {
	$id: 'dex/endpoint/getPositionResponse',
	type: 'object',
	required: ['positionsStoreData'],
	properties: {
		position: {
			dataType: 'object',
			fieldNumber: 1,
		},
	},
};

export const getTickWithTickIdRequestSchema = {
	$id: 'dex/endpoint/getTickWithTickIdRequest',
	type: 'object',
	required: ['tickIDs'],
	properties: {
		tickIDs: {
			type: 'object',
			fieldNumber: 1,
		},
	},
};

export const getTickWithTickIdResponseSchema = {
	$id: 'dex/endpoint/getTickWithTickIdResponse',
	type: 'object',
	required: ['priceTicksStoreData'],
	properties: {
		priceTicksStoreData: {
			type: 'object',
			fieldNumber: 1,
		},
	},
};

export const getTickWithPoolIdAndTickValueRequestSchema = {
	$id: 'dex/endpoint/getTickWithPoolIdAndTickValueRequest',
	type: 'object',
	required: ['poolID', 'tickValue'],
	properties: {
		poolID: {
			dataType: 'bytes',
			fieldNumber: 1,
		},
		tickValue: {
			dataType: 'uint32',
			fieldNumber: 2,
		},
	},
};

export const getTickWithPoolIdAndTickValueResponseSchema = {
	$id: 'dex/endpoint/getTickWithPoolIdAndTickValueResponse',
	type: 'object',
	required: ['priceTicksStoreData'],
	properties: {
		priceTicksStoreData: {
			dataType: 'object',
			fieldNumber: 1,
		},
	},
};

export const getPoolRequestSchema = {
	$id: 'dex/endpoint/getPoolRequest',
	required: ['poolID'],
	type: 'object',
	properties: {
		poolID: {
			type: 'object',
			fieldNumber: 1,
		},
	},
};

export const getPoolResponseSchema = {
	$id: 'dex/endpoint/getPoolResponse',
	type: 'object',
	required: ['poolsStoreData'],
	properties: {
		poolsStoreData: {
			dataType: 'object',
			fieldNumber: 1,
		},
	},
};

export const getPositionIndexRequestSchema = {
	$id: 'dex/endpoint/getPositionIndexRequest',
	type: 'object',
	required: ['positionID'],
	properties: {
		positionID: {
			dataType: 'bytes',
			fieldNumber: 1,
		},
	},
};

export const getPositionIndexResponseSchema = {
	$id: 'dex/endpoint/getPositionIndexResponse',
	type: 'object',
	required: ['priceTicksStoreData'],
	properties: {
		priceTicksStoreData: {
			type: 'object',
			fieldNumber: 1,
		},
	},
};

export const getPoolIDFromTickIDResponseSchema = {
	$id: 'dex/endpoint/getPoolIDFromTickIDResponse',
	type: 'object',
	required: ['poolID'],
	properties: {
		poolID: {
			dataType: 'bytes',
			fieldNumber: 1,
		},
	},
};

export const getFeeTierRequestSchema = {
	$id: 'dex/endpoint/getFeeTierRequest',
	type: 'object',
	required: ['poolID'],
	properties: {
		poolID: {
			dataType: 'bytes',
			fieldNumber: 1,
		},
	},
};

export const getFeeTierResponseSchema = {
	$id: 'dex/endpoint/getFeeTierResponse',
	type: 'object',
	required: ['feeTier'],
	properties: {
		feeTier: {
			dataType: 'uint32',
			fieldNumber: 1,
		},
	},
};

export const getToken1AmountRequestSchema = {
	$id: 'dex/endpoint/getToken1AmountRequest',
	type: 'object',
	required: ['poolID'],
	properties: {
		poolID: {
			dataType: 'bytes',
			fieldNumber: 1,
		},
	},
};

export const getToken1AmountResponseSchema = {
	$id: 'dex/endpoint/getToken1AmountResponse',
	type: 'object',
	required: ['token1Amount'],
	properties: {
		token1Amount: {
			dataType: 'uint64',
			fieldNumber: 1,
		},
	},
};

export const getToken0AmountRequestSchema = {
	$id: 'dex/endpoint/getToken0AmountRequest',
	type: 'object',
	required: ['poolID'],
	properties: {
		poolID: {
			dataType: 'bytes',
			fieldNumber: 1,
		},
	},
};

export const getToken0AmountResponseSchema = {
	$id: 'dex/endpoint/getToken0AmountResponse',
	type: 'object',
	required: ['token0Amount'],
	properties: {
		token0Amount: {
			dataType: 'uint64',
			fieldNumber: 1,
		},
	},
};

export const getLSKPriceResponseSchema = {
	$id: 'dex/endpoint/getLSKPriceResponse',
	type: 'object',
	required: ['lskPrice'],
	properties: {
		lskPrice: {
			dataType: 'uint64',
			fieldNumber: 1,
		},
	},
};

export const getLSKPriceRequestSchema = {
	$id: 'dex/endpoint/getLSKPriceRequest',
	type: 'object',
	required: ['tokenID', 'poolID'],
	properties: {
		tokenID: {
			type: 'object',
			fieldNumber: 1,
		},
		poolID: {
			type: 'object',
			fieldNumber: 2,
		},
	},
};

export const getTVLRequestSchema = {
	$id: 'dex/endpoint/getTVLRequest',
	type: 'object',
	required: ['poolID', 'token0ID', 'token1ID'],
	properties: {
		poolID: {
			dataType: 'bytes',
			fieldNumber: 1,
		},
		token0ID: {
			dataType: 'bytes',
			fieldNumber: 2,
		},
		token1ID: {
			dataType: 'bytes',
			fieldNumber: 3,
		},
	},
};

export const getTVLResponseSchema = {
	$id: 'dex/endpoint/getTVLResponse',
	type: 'object',
	required: ['tvl'],
	properties: {
		tvl: {
			dataType: 'uint64',
			fieldNumber: 1,
		},
	},
};

export const getAllTicksRequestSchema = {
	$id: 'dex/endpoint/getAllTicksRequest',
	type: 'object',
	required: ['poolID'],
	properties: {
		poolID: {
			dataType: 'bytes',
			fieldNumber: 1,
		},
	},
};

export const getAllTicksResponseSchema = {
	$id: 'dex/endpoint/getAllTicksResponse',
	type: 'object',
	required: ['tokenID'],
	properties: {
		tokenID: {
			dataType: 'bytes',
			fieldNumber: 1,
			items: {
				type: 'object',
				required: ['tickID'],
				properties: {
					tickID: {
						dataType: 'bytes',
						fieldNumber: 1,
					},
				},
			},
		},
	},
};

export const getAllTickIDsInPoolRequestSchema = {
	$id: 'dex/endpoint/getAllTickIDsInPoolRequest',
	type: 'object',
	required: ['poolID'],
	properties: {
		poolID: {
			type: 'object',
			fieldNumber: 1,
		},
	},
};

export const getAllTickIDsInPoolResponseSchema = {
	$id: 'dex/endpoint/getAllTickIDsInPoolResponse',
	type: 'object',
	required: ['tickIDs'],
	properties: {
		tickIDs: {
			type: 'array',
			fieldNumber: 1,
			items: {
				type: 'object',
				required: ['tickID'],
				properties: {
					tickID: {
						dataType: 'bytes',
						fieldNumber: 1,
					},
				},
			},
		},
	},
};

export const dryRunSwapExactInRequestSchema = {
	$id: 'dex/dryRunSwapExactIn',
	type: 'object',
	required: ['tokenIdIn', 'amountIn', 'tokenIdOut', 'minAmountOut', 'swapRoute'],
	properties: {
		tokenIdIn: {
			dataType: 'bytes',
			fieldNumber: 1,
		},
		amountIn: {
			dataType: 'uint64',
			fieldNumber: 2,
		},
		tokenIdOut: {
			dataType: 'bytes',
			fieldNumber: 3,
		},
		minAmountOut: {
			dataType: 'uint64',
			fieldNumber: 4,
		},
		swapRoute: {
			type: 'array',
			fieldNumber: 5,
			items: {
				dataType: 'bytes',
			},
		},
	},
};

export const dryRunSwapExactInResponseSchema = {
	$id: 'dex/dryRunSwapExactInResponse',
	type: 'object',
	required: ['newAmountIn', 'tokensAmount', 'priceBefore', 'priceAfter'],
	properties: {
		newAmountIn: {
			dataType: 'uint64',
			fieldNumber: 1,
		},
		tokensAmount: {
			dataType: 'uint64',
			fieldNumber: 2,
		},
		priceBefore: {
			dataType: 'bytes',
			fieldNumber: 3,
		},
		priceAfter: {
			dataType: 'bytes',
			fieldNumber: 4,
		},
	},
};

export const swapExactInCommandSchema = {
	$id: '/dex/swapExactInCommandSchema',
	type: 'object',
	required: [
		'tokenIdIn',
		'amountTokenIn',
		'tokenIdOut',
		'minAmountTokenOut',
		'swapRoute',
		'maxTimestampValid',
	],
	properties: {
		tokenIdIn: {
			dataType: 'bytes',
			fieldNumber: 1,
		},
		amountTokenIn: {
			dataType: 'uint64',
			fieldNumber: 2,
		},
		tokenIdOut: {
			dataType: 'bytes',
			fieldNumber: 3,
		},
		minAmountTokenOut: {
			dataType: 'uint64',
			fieldNumber: 4,
		},
		swapRoute: {
			type: 'array',
			fieldNumber: 5,
			items: {
				dataType: 'bytes',
			},
		},
		maxTimestampValid: {
			dataType: 'uint64',
			fieldNumber: 6,
		},
	},
};

export const swapExactOutCommandSchema = {
	$id: '/dex/swapExactOutCommandSchema',
	type: 'object',
	required: [
		'tokenIdIn',
		'maxAmountTokenIn',
		'tokenIdOut',
		'amountTokenOut',
		'swapRoute',
		'maxTimestampValid',
	],
	properties: {
		tokenIdIn: {
			dataType: 'bytes',
			fieldNumber: 1,
		},
		maxAmountTokenIn: {
			dataType: 'uint64',
			fieldNumber: 2,
		},
		tokenIdOut: {
			dataType: 'bytes',
			fieldNumber: 3,
		},
		amountTokenOut: {
			dataType: 'uint64',
			fieldNumber: 4,
		},
		swapRoute: {
			type: 'array',
			fieldNumber: 5,
			items: {
				dataType: 'bytes',
			},
		},
		maxTimestampValid: {
			dataType: 'uint64',
			fieldNumber: 6,
		},
	},
};

export const swapWithPriceLimitCommandSchema = {
	$id: '/dex/swapWithPriceLimitCommandSchema',
	type: 'object',
	required: [
		'tokenIdIn',
		'maxAmountTokenIn',
		'tokenIdOut',
		'minAmountTokenOut',
		'poolId',
		'maxTimestampValid',
		'sqrtLimitPrice',
	],
	properties: {
		tokenIdIn: {
			dataType: 'bytes',
			fieldNumber: 1,
		},
		maxAmountTokenIn: {
			dataType: 'uint64',
			fieldNumber: 2,
		},
		tokenIdOut: {
			dataType: 'bytes',
			fieldNumber: 3,
		},
		minAmountTokenOut: {
			dataType: 'uint64',
			fieldNumber: 4,
		},
		poolId: {
			dataType: 'bytes',
			fieldNumber: 5,
		},
		maxTimestampValid: {
			dataType: 'uint64',
			fieldNumber: 6,
		},
		sqrtLimitPrice: {
			dataType: 'uint64',
			fieldNumber: 7,
		},
	},
};
