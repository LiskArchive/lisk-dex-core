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

export const poolsSchema = {
    $id: '/dex/pools',
    "type": "object",
    "required": [
        "liquidity",
        "sqrtPrice",
        "feeGrowthGlobal0",
        "feeGrowthGlobal1",
        "tickSpacing"
    ],
    "properties": {
        "liquidity": {
            "dataType": "uint64",
            "fieldNumber": 1
        },
        "sqrtPrice": {
            "dataType": "bytes",
            "maxLength": MAX_NUM_BYTES_Q96,
            "fieldNumber": 2
        },
        "feeGrowthGlobal0": {
            "dataType": "bytes",
            "maxLength": MAX_NUM_BYTES_Q96,
            "fieldNumber": 3
        },
        "feeGrowthGlobal1": {
            "dataType": "bytes",
            "maxLength": MAX_NUM_BYTES_Q96,
            "fieldNumber": 4
        },
        "tickSpacing": {
            "dataType": "uint32",
            "fieldNumber": 5
        }
    }
}

export const priceTicksSchema = {
    $id: '/dex/priceTicks',
    "type": "object",
    "required": [
        "liquidityNet",
        "liquidityGross",
        "feeGrowthOutside0",
        "feeGrowthOutside1"
    ],
    "properties": {
        "liquidityNet": {
            "dataType": "sint64",
            "fieldNumber": 1
        },
        "liquidityGross": {
            "dataType": "uint64",
            "fieldNumber": 2
        },
        "feeGrowthOutside0": {
            "dataType": "bytes",
            "maxLength": MAX_NUM_BYTES_Q96,
            "fieldNumber": 3
        },
        "feeGrowthOutside1": {
            "dataType": "bytes",
            "maxLength": MAX_NUM_BYTES_Q96,
            "fieldNumber": 4
        }
    }
}

export const positionsSchema = {
    $id: '/dex/positions',
    "type": "object",
    "required": [
        "tickLower",
        "tickUpper",
        "liquidity",
        "feeGrowthInsideLast0",
        "feeGrowthInsideLast1",
        "ownerAddress"
    ],
    "properties": {
        "tickLower": {
            "dataType": "sint32",
            "fieldNumber": 1
        },
        "tickUpper": {
            "dataType": "sint32",
            "fieldNumber": 2
        },
        "liquidity": {
            "dataType": "uint64",
            "fieldNumber": 3
        },
        "feeGrowthInsideLast0": {
            "dataType": "bytes",
            "maxLength": MAX_NUM_BYTES_Q96,
            "fieldNumber": 4
        },
        "feeGrowthInsideLast1": {
            "dataType": "bytes",
            "maxLength": MAX_NUM_BYTES_Q96,
            "fieldNumber": 5
        },
        "ownerAddress": {
            "dataType": "bytes",
            "length": NUM_BYTES_ADDRESS,
            "fieldNumber": 6
        }
    }
}

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

export const createPoolParamsSchema = {
    $id: '/dex/createPoolParamsSchema',
    "type": "object",
    "required": [
        "tokenID0",
        "tokenID1",
        "feeTier",
        "tickInitialPrice",
        "initialPosition",
        "maxTimestampValid"
    ],
    "properties": {
        "tokenID0": {
            "dataType": "bytes",
            "fieldNumber": 1
        },
        "tokenID1": {
            "dataType": "bytes",
            "fieldNumber": 2
        },
        "feeTier": {
            "dataType": "uint32",
            "fieldNumber": 3
        },
        "tickInitialPrice": {
            "dataType": "sint32",
            "fieldNumber": 4
        },
        "initialPosition": {
            "type": "object",
            "fieldNumber": 5,
            "required": [
                "tickLower",
                "tickUpper",
                "amount0Desired",
                "amount1Desired"
            ],
            "properties": {
                "tickLower": {
                    "dataType": "sint32",
                    "fieldNumber": 1
                },
                "tickUpper": {
                    "dataType": "sint32",
                    "fieldNumber": 2
                },
                "amount0Desired": {
                    "dataType": "uint64",
                    "fieldNumber": 3
                },
                "amount1Desired": {
                    "dataType": "uint64",
                    "fieldNumber": 4
                }
            }
        },
        "maxTimestampValid": {
            "dataType": "uint64",
            "fieldNumber": 6
        }
    }
}


export const addLiquidityParamsSchema = {
    $id: '/dex/addLiquidityParamsSchema',
    "type": "object",
    "required": [
        "positionID",
        "amount0Desired",
        "amount1Desired",
        "amount0Min",
        "amount1Min",
        "maxTimestampValid"
    ],
    "properties": {
        "positionID": {
            "dataType": "bytes",
            "fieldNumber": 1
        },
        "amount0Desired": {
            "dataType": "uint64",
            "fieldNumber": 2
        },
        "amount1Desired": {
            "dataType": "uint64",
            "fieldNumber": 3
        },
        "amount0Min": {
            "dataType": "uint64",
            "fieldNumber": 4
        },
        "amount1Min": {
            "dataType": "uint64",
            "fieldNumber": 5
        },
        "maxTimestampValid": {
            "dataType": "uint64",
            "fieldNumber": 6
        }
    }
}
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

export const collectFeesSchema = {
    $id: '/dex/collectFees',
    "type": "object",
    "required": ["positions"],
    "properties": {
        "positions": {
            "type": "array",
            "fieldNumber": 1,
            "items": {
                "type": "object",
                "required": ["positionID"],
                "properties": {
                    "positionID": {
                        "dataType": "bytes",
                        "fieldNumber": 1
                    },
                }
            }
        }
    }
}
