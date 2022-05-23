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

export const poolsSchema = {
    $id: '/dex/pools',
    "type": "object",
    "required": [
        "liquidity",
        "sqrtPrice",
        "feeGrowthGlobal0",
        "feeGrowthGlobal1",
        "protocolFees0",
        "protocolFees1",
        "tickSpacing"
    ],
    "properties": {
        "liquidity": {
            "dataType": "uint64",
            "fieldNumber": 1
        },
        "sqrtPrice": {
            "dataType": "bytes",
            "fieldNumber": 2
        },
        "feeGrowthGlobal0": {
            "dataType": "bytes",
            "fieldNumber": 3
        },
        "feeGrowthGlobal1": {
            "dataType": "bytes",
            "fieldNumber": 4
        },
        "protocolFees0": {
            "dataType": "uint64",
            "fieldNumber": 5
        },
        "protocolFees1": {
            "dataType": "uint64",
            "fieldNumber": 6
        },
        "tickSpacing": {
            "dataType": "uint32",
            "fieldNumber": 7
        }
    }
}

export const priceTickSchema = {
    $id: '/dex/priceTick',
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
            "fieldNumber": 3
        },
        "feeGrowthOutside1": {
            "dataType": "bytes",
            "fieldNumber": 4
        }
    }
}

export const positionSchema = {
    $id: '/dex/position',
    "type": "object",
    "required": [
        "tickLower",
        "tickUpper",
        "liquidity",
        "feeGrowthInsideLast0",
        "feeGrowthInsideLast1"
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
            "fieldNumber": 4
        },
        "feeGrowthInsideLast1": {
            "dataType": "bytes",
            "fieldNumber": 5
        }
    }
}

export const positionSchema = {
    $id: '/dex/position',
    "type": "object",
    "required": [
        "tickLower",
        "tickUpper",
        "liquidity",
        "feeGrowthInsideLast0",
        "feeGrowthInsideLast1"
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
            "fieldNumber": 4
        },
        "feeGrowthInsideLast1": {
            "dataType": "bytes",
            "fieldNumber": 5
        }
    }
}

export const settingsSchema = {
    $id: '/dex/settings',
    "type": "object",
    "required": ["protocolFeeAddress", "protocolFeePercentage", "poolCreationSettings"],
    "properties": {
        "protocolFeeAddress": {
            "dataType": "bytes",
            "fieldNumber": 1
        },
        "protocolFeePercentage": {
            "dataType": "uint32",
            "fieldNumber": 2
        },
        "poolCreationSettings": {
            "type": "array",
            "fieldNumber": 3,
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

export const settingsSchema = {
    $id: '/dex/settings',
    "type": "object",
    "required": ["protocolFeeAddress", "protocolFeePercentage", "poolCreationSettings"],
    "properties": {
        "protocolFeeAddress": {
            "dataType": "bytes",
            "fieldNumber": 1
        },
        "protocolFeePercentage": {
            "dataType": "uint32",
            "fieldNumber": 2
        },
        "poolCreationSettings": {
            "type": "array",
            "fieldNumber": 3,
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
