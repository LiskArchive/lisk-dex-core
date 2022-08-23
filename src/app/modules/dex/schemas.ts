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
    NUM_BYTES_ADDRESS
} from './constants'

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
    "type": "object",
    "required": [
        "protocolFeeAddress",
        "protocolFeePart",
        "validatorsLSKRewardsPart",
        "poolCreationSettings"
    ],
    "properties": {
        "protocolFeeAddress": {
            "dataType": "bytes",
            "length": NUM_BYTES_ADDRESS,
            "fieldNumber": 1
        },
        "protocolFeePart": {
            "dataType": "uint32",
            "fieldNumber": 2
        },
        "validatorsLSKRewardsPart": {
            "dataType": "uint32",
            "fieldNumber": 3
        },
        "poolCreationSettings": {
            "type": "array",
            "fieldNumber": 4,
            "items": {
                "type": "object",
                "required": ["feeTier", "tickSpacing"],
                "properties": {
                    "feeTier": {
                        "dataType": "uint32",
                        "fieldNumber": 1
                    },
                    "tickSpacing": {
                        "dataType": "uint32",
                        "fieldNumber": 2
                    }
                }
            }
        }
    }
}