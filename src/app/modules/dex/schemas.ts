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
import { PoolsStore } from './stores';

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

export const getAllPoolIdsRequestSchema = {
	$id: 'dex/getAllPoolIds',
	type: 'object',
	required: ['poolStore'],
	properties: {
		poolStore: PoolsStore,
	},
};

export const getAllPoolIdsResponseSchema = {
	$id: 'dex/getAllPoolIds',
	type: 'object',
	required: ['PoolID'],
	properties: {
		PoolID: Buffer
	},
};

export const getToken0AmountResponseSchema = {
	$id: 'dex/getToken0Amount',
	type: 'object',
	required: ['poolID'],
	properties: {
		poolID: {
			dataType: 'bytes',
			fieldNumber: 1,
		}
	}
}

export const getToken0AmountRequestSchema = {
	$id: 'dex/getToken0Amount',
	type: 'object',
	required: ['token0Amount'],
	properties: {
		Token1Amount: {
			dataType: 'uint64',
			fieldNumber: 1,
		}
	}
}
export const getFeeTierResquestSchema = {
	$id: 'dex/getFeeTier',
	type: 'object',
	required: ['poolId'],
	properties: {
		poolId: {
			dataType: 'bytes',
			fieldNumber: 1,
		},
	},
};

export const getFeeTierResponseSchema = {
	$id: 'dex/getFeeTier',
	type: 'object',
	required: ['feeTier'],
	properties: {
		feeTier: {
			dataType: 'uint32',
			fieldNumber: 1,
		},
	},
};

export const getPoolIDFromTickIDRequestSchema = {
	$id: 'dex/getPoolIDFromTickID',
	type: 'object',
	required: ['tickID'],
	properties: {
		tickID: {
			dataType: 'bytes',
			stores: {
				dataType: 'object',
				fieldNumber: 1,
			}
		},
	}
}

export const getAllTokenIdsResponseSchema = {
	$id: 'dex/getAllTokenIds',
	type: 'object',
	required: ['tokens'],
	properties: {
		tokens: {
			type: 'set',
			fieldNumber: 1,
		}
	},
};

export const getPoolIDFromTickIDResponseSchema = {
	$id: 'dex/getPoolIDFromTickID',
	type: 'object',
	required: ['poolId'],
	properties: {
		poolId: {
			dataType: 'bytes',
			fieldNumber: 1,
		}
	},
};

export const getPositionIndexResquestSchema = {
	$id: 'dex/getPositionIndex',
	type: 'object',
	required: ['positionId'],
	properties: {
		positionId: {
			dataType: 'bytes',
			fieldNumber: 1,
		},
	},
};

export const getPositionIndexResponseSchema = {
	$id: 'dex/getPositionIndex',
	type: 'object',
	required: ['positionIndex'],
	properties: {
		positionIndex: {
			dataType: 'unit32',
			fieldNumber: 1,
		},
	},
};

export const getToken1AmountResponseSchema = {
	$id: 'dex/getToken1Amount',
	type: 'object',
	required: ['poolID'],
	properties: {
		poolID: {
			dataType: 'bytes',
			fieldNumber: 1,
		},
	},
};

export const getToken1AmountRequestSchema = {
	$id: 'dex/getToken1Amount',
	type: 'object',
	required: ['token1Amount'],
	properties: {
		Token1Amount: {
			dataType: 'uint64',
			fieldNumber: 1,
		},
	},
};

export const getLSKPriceResponseSchema = {
	$id: 'dex/getLSKPrice',
	type: 'object',
	required: ['tokenMethod', 'methodContext', 'stores', 'tokenId'],
	properties: {
		tokenMethod: {
			dataType: 'object',
			fieldNumber: 1,
		},
		methodContext: {
			dataType: 'object',
			fieldNumber: 2,
		},
		stores: {
			dataType: 'object',
			fieldNumber: 3,
		},
		tokenId: {
			dataType: 'bytes',
			fieldNumber: 4,
		},
	},
};

export const getLSKPriceRequestSchema = {
	$id: 'dex/getLSKPrice',
	type: 'object',
	required: ['lskPrice'],
	properties: {
		lskPrice: {
			dataType: 'uint64',
			fieldNumber: 1,
		},
	},
};

export const getTVLResponseSchema = {
	$id: 'dex/getTVL',
	type: 'object',
	required: ['tokenMethod', 'methodContext', 'stores', 'poolId'],
	properties: {
		tokenMethod: {
			dataType: 'object',
			fieldNumber: 1,
		},
		methodContext: {
			dataType: 'object',
			fieldNumber: 2,
		},
		stores: {
			dataType: 'object',
			fieldNumber: 3,
		},
		poolId: {
			dataType: 'bytes',
			fieldNumber: 4,
		},
	},
};

export const getTVLRequestSchema = {
	$id: 'dex/getTVL',
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
	$id: 'dex/getAllTicks',
	type: 'object',
	required: ['methodContext', 'stores', 'poolId'],
	properties: {
		methodContext: {
			dataType: 'object',
			fieldNumber: 1,
		},
		stores: {
			dataType: 'object',
			fieldNumber: 2,
		},
	},
};

export const getAllTicksResponseSchema = {
	$id: 'dex/getAllTicks',
	type: 'object',
	required: ['tickIDs'],
	properties: {
		tickIDs: {
			type: 'array',
			fieldNumber: 1,
			items: {
				type: 'object',
				required: ['tickId'],
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

export const getAllTickIDsInPoolRequestSchema = {
	$id: 'dex/getAllTickIDsInPool',
	type: 'object',
	required: ['methodContext', 'stores', 'poolId'],
	properties: {
		methodContext: {
			dataType: 'object',
			fieldNumber: 1,
		},
		stores: {
			dataType: 'object',
			fieldNumber: 2,
		},
		poolId: {
			dataType: 'bytes',
			fieldNumber: 3,
		},
	},
};

export const getAllTickIDsInPoolRsponseSchema = {
	$id: 'dex/getAllTickIDsInPool',
	type: 'object',
	required: ['tickIDs'],
	properties: {
		tickIDs: {
			type: 'array',
			fieldNumber: 1,
			items: {
				type: 'object',
				required: ['tickId'],
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
