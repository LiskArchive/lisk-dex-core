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
    apiClient,
    TokenAPI
} from 'lisk-sdk';

import {
    codec
} from '@liskhq/lisk-codec';

import {
    utils
} from '@liskhq/lisk-cryptography';

import {
    NUM_BYTES_ADDRESS,
    NUM_BYTES_TOKEN_ID,
    NUM_BYTES_POSITION_ID,
    MODULE_ID_DEX,
    NUM_BYTES_POOL_ID,
    MAX_TICK,
    MIN_TICK,
    NFT_COLLECTION_DEX,
    POOL_CREATION_FAILED_ALREADY_EXISTS,
    POOL_CREATION_FAILED_INVALID_FEE_TIER,
    POOL_CREATION_SUCCESS,
    POSITION_CREATION_FAILED_INVALID_TICKS,
    POSITION_CREATION_FAILED_INVALID_TICK_SPACING,
    POSITION_CREATION_FAILED_NO_POOL,
    POSITION_CREATION_SUCCESS,
    POSITION_UPDATE_FAILED_INSUFFICIENT_LIQUIDITY,
    POSITION_UPDATE_FAILED_NOT_EXISTS,
    POSITION_UPDATE_FAILED_NOT_OWNER,
    TOKEN_ID_LSK,
    TOKEN_ID_REWARDS
} from '../constants';

import {
    uint32beInv
} from "./bigEndian";

import {
    PoolID,
    PositionID,
    Address,
    TokenID,
    ModuleConfig,
    Q96
} from "../types";

import {
    addQ96,
    subQ96,
    divQ96,
    mulQ96,
    mulDivQ96,
    numberToQ96,
    roundUpQ96,
    roundDownQ96,
    q96ToInt,
    q96ToIntRoundUp
} from './q96'

import {
    getAmount0Delta,
    getAmount1Delta,
    priceToTick,
    tickToPrice
} from './math';

const abs = (x) => {
    return x < 0n ? -x : x
}

export const poolIdToAddress = (poolId: PoolID): Address => {
    const _address: Buffer = utils.hash(poolId);
    return _address.slice(0, NUM_BYTES_ADDRESS);
}

export const getToken0Id = (poolId: PoolID): TokenID => poolId.slice(0, NUM_BYTES_TOKEN_ID + 1);

export const getToken1Id = (poolId: PoolID): TokenID => poolId.slice(NUM_BYTES_TOKEN_ID, (2 * NUM_BYTES_TOKEN_ID) + 1);

export const getFeeTier = (poolId: PoolID): number => {
    const _buffer: Buffer = poolId.slice(-4);
    const _hexBuffer: string = _buffer.toString('hex');

    return uint32beInv(_hexBuffer);
}

export const getPositionIndex = (positionId: PositionID): number => {
    const _buffer: Buffer = positionId.slice(2 * NUM_BYTES_POSITION_ID, NUM_BYTES_ADDRESS);
    const _hexBuffer: string = _buffer.toString('hex');

    return uint32beInv(_hexBuffer);
}

export const transferToPool = async (tokenAPI: TokenAPI, apiContext, senderAddress: Address, poolId: PoolID, tokenId: TokenID, amount: bigint): Promise < void > => {
    const poolAddress = poolIdToAddress(poolId);
    await tokenAPI.transfer(apiContext, senderAddress, poolAddress, tokenId, amount);
    await tokenAPI.lock(apiContext, poolAddress, MODULE_ID_DEX, tokenId, amount);
}

export const transferFromPool = async (
    tokenAPI: TokenAPI,
    apiContext,
    poolId: PoolID,
    recipientAddress: Address,
    tokenId: TokenID,
    amount: bigint
): Promise < void > => {
    const poolAddress = poolIdToAddress(poolId)
    await tokenAPI.unlock(apiContext, poolAddress, MODULE_ID_DEX, tokenId, amount)
    await tokenAPI.transfer(apiContext, poolAddress, recipientAddress, tokenId, amount)
}

export const transferPoolToPool = async (
    tokenAPI: TokenAPI,
    apiContext,
    poolIdSend: PoolID,
    poolIdReceive: PoolID,
    tokenId: TokenID,
    amount: bigint
): Promise < void > => {
    const poolAddressSend = poolIdToAddress(poolIdSend)
    const poolAddressReceive = poolIdToAddress(poolIdReceive)
    await tokenAPI.unlock(apiContext, poolAddressSend, MODULE_ID_DEX, tokenId, amount)
    await tokenAPI.transfer(apiContext, poolAddressSend, poolAddressReceive, tokenId, amount)
    await tokenAPI.lock(apiContext, poolAddressReceive, MODULE_ID_DEX, tokenId, amount)
}

export const transferToProtocolFeeAccount = async (
    tokenAPI: TokenAPI,
    apiContext,
    settings: ModuleConfig,
    senderAddress: Address,
    tokenId: TokenID,
    amount: bigint
): Promise < void > => {
    await tokenAPI.transfer(apiContext, senderAddress, settings.protocolFeeAddress, tokenId, amount)
}

export const checkPositionExistenceAndOwnership = async (stores, events, apiContext, senderAddress: Address, positionID: PositionID): Promise < void > => {
    const positionsStore = stores.positions;
    if (!positionsStore.getKey(senderAddress, positionID)) {
        events.get(TYPE_ID_POSITION_UDPATE_FAILED).log(apiContext, {
            senderAddress,
            positionID,
            result: POSITION_UPDATE_FAILED_NOT_EXISTS
        });
        throw new Error();
    }
    if (senderAddress != getOwnerAddressOfPosition(positionID)) {
        events.get(TYPE_ID_POSITION_UDPATE_FAILED).log(apiContext, {
            senderAddress,
            positionID,
            result: POSITION_UPDATE_FAILED_NOT_OWNER
        });
        throw new Error()
    }
}

export const collectFeesAndIncentives = async (events: NamedRegistry, positionStore, dexGlobalState, tokenAPI, apiContext, positionID: PositionID): Promise < void > => {
    const poolID = getPoolIDFromPositionID(positionID)
    const positionInfo = positionStore.get(positionID)
    const ownerAddress = getOwnerAddressOfPosition(positionID)
    const [collectableFees0, collectableFees1, feeGrowthInside0, feeGrowthInside1] = await computeCollectableFees(positionStore, positionID)

    if (collectableFees0 > 0) {
        transferFromPool(tokenAPI, apiContext, poolID, ownerAddress, getToken0Id(poolID), collectableFees0)
    }
    if (collectableFees1 > 0) {
        transferFromPool(tokenAPI, apiContext, poolID, ownerAddress, getToken1Id(poolID), collectableFees1)
    }
    positionInfo.feeGrowthInsideLast0 = feeGrowthInside0
    positionInfo.feeGrowthInsideLast1 = feeGrowthInside1

    positionStore.set(apiContext, positionID, positionInfo)

    const [collectableFeesLSK, incentivesForPosition] = await computeCollectableIncentives(dexGlobalState, tokenAPI, positionID, collectableFees0, collectableFees1)

    tokenAPI.transfer(ADDRESS_LIQUIDITY_PROVIDERS_REWARDS_POOL, ownerAddress, TOKEN_ID_REWARDS, incentivesForPosition)
    dexGlobalState.collectableLSKFees = dexGlobalState.collectableLSKFees - collectableFeesLSK


    events.get(TYPE_ID_FEES_INCENTIVES_COLLECTED).log(apiContext, {
        ownerAddress,
        positionID,
        "collectedFees0": collectableFees0,
        "tokenID0": getToken0Id(poolID),
        "collectedFees1": collectableFees1,
        "tokenID1": getToken1Id(poolID),
        "collectedIncentives": incentivesForPosition,
        "tokenIDIncentives": TOKEN_ID_REWARDS
    });
}


export const computeCollectableFees = async (positionStore, positionID: PositionID): Promise < [bigint, bigint, Q96, Q96] > => {
    const positionInfo = positionStore(positionID)
    const poolID = getPoolIDFromPositionID(positionID)
    const [feeGrowthInside0, feeGrowthInside1] = getFeeGrowthInside(positionID)

    const collectableFees0 = roundDownQ96(mulQ96(subQ96(feeGrowthInside0, positionInfo.feeGrowthInsideLast0), positionInfo.liquidity))
    const collectableFees1 = roundDownQ96(mulQ96(subQ96(feeGrowthInside1, positionInfo.feeGrowthInsideLast1), positionInfo.liquidity))

    return [collectableFees0, collectableFees1, feeGrowthInside0, feeGrowthInside1]
}


export const computeCollectableIncentives = async (dexGlobalState, tokenAPI, positionID: PositionID, collectableFees0: number, collectableFees1: number): Promise < [number, number] > => {
    const poolID = getPoolIDFromPositionID(positionID)
    let collectableFeesLSK = 0
    if (getToken0Id(poolID) == TOKEN_ID_LSK) {
        collectableFeesLSK = collectableFees0
    } else if (getToken1Id(poolID) == TOKEN_ID_LSK) {
        collectableFeesLSK = collectableFees1
    }

    if (collectableFeesLSK == 0) {
        return [0, 0]
    }

    const totalCollectableLSKFees = dexGlobalState.collectableLSKFees
    const availableLPIncentives = tokenAPI.getAvailableBalance(ADDRESS_LIQUIDITY_PROVIDERS_REWARDS_POOL, TOKEN_ID_REWARDS)
    const incentivesForPosition = (availableLPIncentives * collectableFeesLSK) / totalCollectableLSKFees
    return [collectableFeesLSK, incentivesForPosition]
}

export const computePoolID = async (tokenID0: TokenID, tokenID1: TokenID, feeTier: number): Promise < Buffer > => {
    const feeTierBuffer = Buffer.alloc(4);
    feeTierBuffer.writeInt8(feeTier, 0);
    return Buffer.concat([tokenID0, tokenID1, feeTierBuffer]);
}

export const createPool = async (settings, apiContext, poolsStore, tokenID0: TokenID, tokenID1: TokenID, feeTier: number, initialSqrtPrice: Q96): Promise < number > => {
    const poolSetting = settings.poolCreationSettings.find(s => s.feeTier == feeTier)

    if (!poolSetting) {
        return POOL_CREATION_FAILED_INVALID_FEE_TIER
    }

    const poolID = computePoolID(tokenID0, tokenID1, feeTier)
    if (poolsStore.getKey(poolID)) {
        return POOL_CREATION_FAILED_ALREADY_EXISTS
    }

    const poolStoreValue = {
        "liquidity": 0,
        "sqrtPrice": initialSqrtPrice,
        "feeGrowthGlobal0": numberToQ96(BigInt(0)),
        "feeGrowthGlobal1": numberToQ96(BigInt(0)),
        "protocolFees0": numberToQ96(BigInt(0)),
        "protocolFees1": numberToQ96(BigInt(0)),
        "tickSpacing": poolSetting.tickSpacing
    }
    poolsStore.set(apiContext, poolID, poolStoreValue);
    return POOL_CREATION_SUCCESS
}

export const createPosition(apiContext, poolsStore, priceTicksStore, priceTickSchema, positionsStore, positionSchema, senderAddress: Address, poolID: PoolID, tickLower: number, tickUpper: number): [number, PositionID] => {
    if (!poolsStore.getKey(senderAddress, poolID)) {
        return [POSITION_CREATION_FAILED_NO_POOL, Buffer.from([])]
    }
    const currentPool = poolsStore.getKey(senderAddress, poolID)

    if (MIN_TICK > tickLower || tickLower >= tickUpper || tickUpper > MAX_TICK) {
        return [POSITION_CREATION_FAILED_INVALID_TICKS, Buffer.from([])]
    }

    if (tickLower % currentPool.tickSpacing != 0 || tickUpper % currentPool.tickSpacing != 0) {
        return [POSITION_CREATION_FAILED_INVALID_TICK_SPACING, Buffer.from([])]
    }

    if (!priceTicksStore.getKey(poolID, tickLower)) {
        const tickStoreValue = {
            "liquidityNet": 0,
            "liquidityGross": 0,
            "feeGrowthOutside0": numberToQ96(BigInt(0)),
            "feeGrowthOutside1": numberToQ96(BigInt(0))
        }
        if (currentPool.sqrtPrice >= tickToPrice(tickLower)) {
            tickStoreValue.feeGrowthOutside0 = currentPool.feeGrowthGlobal0
            tickStoreValue.feeGrowthOutside1 = currentPool.feeGrowthGlobal1
        }

        priceTicksStore.set(poolID, tickLower, codec.encode(priceTickSchema, tickStoreValue));
    }

    if (!priceTicksStore.getKey(poolID, tickUpper)) {
        const tickStoreValue = {
            "liquidityNet": 0,
            "liquidityGross": 0,
            "feeGrowthOutside0": numberToQ96(BigInt(0)),
            "feeGrowthOutside1": numberToQ96(BigInt(0))
        }
        if (currentPool.sqrtPrice >= tickToPrice(tickUpper)) {
            tickStoreValue.feeGrowthOutside0 = currentPool.feeGrowthGlobal0
            tickStoreValue.feeGrowthOutside1 = currentPool.feeGrowthGlobal1
        }

        priceTicksStore.set(poolID, tickUpper, codec.encode(priceTickSchema, tickStoreValue));
    }

    const positionID = await getNewPositionID(poolID, senderAddress)

    const positionValue = {
        "tickLower": tickLower,
        "tickUpper": tickUpper,
        "liquidity": 0,
        "feeGrowthInsideLast0": numberToQ96(BigInt(0)),
        "feeGrowthInsideLast1": numberToQ96(BigInt(0)),
        "ownerAddress": senderAddress
    }
    positionsStore.set(positionID, codec.encode(positionSchema, positionValue))
    return [POSITION_CREATION_SUCCESS, positionID]
}


export const getFeeGrowthInside = (positionsStore, poolsStore, priceTicksStore, positionID: PositionID): [Q96, Q96] => {
    const positionInfo = positionsStore.get(positionID)
    const poolID = getPoolIDFromPositionID(positionID)
    const poolInfo = poolsStore.get(poolID)

    const tickLower = positionInfo.tickLower
    const tickUpper = positionInfo.tickUpper
    const tickCurrent = priceToTick(poolInfo.sqrtPrice)
    const lowerTickInfo = priceTicksStore.getKey(poolID, tickLower)
    const upperTickInfo = priceTicksStore.getKey(poolID, tickUpper)

    if (tickCurrent >= tickLower) {
        const feeGrowthBelow0 = lowerTickInfo.feeGrowthOutside0
        const feeGrowthBelow1 = lowerTickInfo.feeGrowthOutside1
    } else {
        const feeGrowthBelow0 = subQ96(poolInfo.feeGrowthGlobal0, lowerTickInfo.feeGrowthOutside0)
        const feeGrowthBelow1 = subQ96(poolInfo.feeGrowthGlobal1, lowerTickInfo.feeGrowthOutside1)
    }

    if (tickCurrent < tickUpper) {
        const feeGrowthAbove0 = upperTickInfo.feeGrowthOutside0
        const feeGrowthAbove1 = upperTickInfo.feeGrowthOutside1
    } else {
        const feeGrowthAbove0 = subQ96(poolInfo.feeGrowthGlobal0, upperTickInfo.feeGrowthOutside0)
        const feeGrowthAbove1 = subQ96(poolInfo.feeGrowthGlobal1, upperTickInfo.feeGrowthOutside1)
    }

    const feeGrowthInside0 = subQ96(subQ96(poolInfo.feeGrowthGlobal0, feeGrowthBelow0), feeGrowthAbove0)
    const feeGrowthInside1 = subQ96(subQ96(poolInfo.feeGrowthGlobal1, feeGrowthBelow1), feeGrowthAbove1)
    return [feeGrowthInside0, feeGrowthInside1]
}


export const getLiquidityForAmounts = (currentSqrtPrice: Q96,
    lowerTickSqrtPrice: Q96,
    upperTickSqrtPrice: Q96,
    amount0: number,
    amount1: number): number => {
    if (lowerTickSqrtPrice > upperTickSqrtPrice) {
        throw new Error()
    }

    if (currentSqrtPrice <= lowerTickSqrtPrice) {
        const liquidity = getLiquidityForAmount0(lowerTickSqrtPrice, upperTickSqrtPrice, amount0)
    } else if (currentSqrtPrice < upperTickSqrtPrice) {
        const liquidity0 = getLiquidityForAmount0(currentSqrtPrice, upperTickSqrtPrice, amount0)
        const liquidity1 = getLiquidityForAmount1(lowerTickSqrtPrice, currentSqrtPrice, amount1)

        if (liquidity0 < liquidity1) {
            liquidity = liquidity0
        } else {
            liquidity = liquidity1
        }
    } else {
        liquidity = getLiquidityForAmount1(lowerTickSqrtPrice, upperTickSqrtPrice, amount1)
    }
    if (liquidity < 0 || liquidity >= 2 ** 64) {
        throw new Error()
    }
    return liquidity
}

export const getLiquidityForAmount0 = (lowerSqrtPrice: Q96, upperSqrtPrice: Q96, amount0: bigint): bigint => {
    const intermediate = mulDivQ96(lowerSqrtPrice, upperSqrtPrice, numberToQ96(BigInt(1)))
    const result = mulDivQ96(numberToQ96(amount0), intermediate, subQ96(upperSqrtPrice, lowerSqrtPrice))
    return roundDownQ96(result)
}

export const getLiquidityForAmount1 = (lowerSqrtPrice: Q96, upperSqrtPrice: Q96, amount1: bigint): bigint => {
    const result = mulDivQ96(numberToQ96(amount1), numberToQ96(BigInt(1)), subQ96(upperSqrtPrice, lowerSqrtPrice))
    return roundDownQ96(result)
}



export const getNewPositionID = async (dexGlobalState, poolID: PoolID, ownerAddress: Address): Promise < Buffer > => {
    const positionIndex = dexGlobalState.positionCounter
    dexGlobalState.positionCounter = dexGlobalState.positionCounter + 1

    return Buffer.concat([poolID, Buffer.from(positionIndex)])
}


export const getOwnerAddressOfPosition = async (positionsStore, positionID: PositionID): Promise < Buffer > => {
    return positionsStore.get(positionID).ownerAddress
}

export const getPoolIDFromPositionID = async (positionID: PositionID): Promise < Buffer > => {
    return positionID.slice(-NUM_BYTES_POOL_ID)
}


export const updatePosition = (apiContext, events, positionsStore, poolsStore, priceTicksStore, dexGlobalState, TokenAPI, positionID: PositionID, liquidityDelta: number): [number, number] => {
    const positionInfo = positionsStore.get(positionID)
    if (-liquidityDelta > positionInfo.liquidity) {
        const ownerAddress = getOwnerAddressOfPosition(positionsStore, positionID)

        events.get(TYPE_ID_POSITION_UPDATE_FAILED).log(apiContext, {
            ownerAddress,
            positionID,
            result: POSITION_UPDATE_FAILED_INSUFFICIENT_LIQUIDITY
        });
        throw new Error()
    }

    collectFeesAndIncentives(events, positionsStore, dexGlobalState, TokenAPI, apiContext, positionID)

    if (liquidityDelta == 0) {
        const amount0 = 0
        const amount1 = 0
        return [amount0, amount1]
    }

    const poolID = await getPoolIDFromPositionID(positionID)
    const poolInfo = poolsStore.get(poolID)
    const lowerTickInfo = priceTicksStore.get(poolID, positionInfo.tickLower)
    const upperTickInfo = priceTicksStore.get(poolID, positionInfo.tickUpper)
    const sqrtPriceLow = tickToPrice(positionInfo.tickLower)
    const sqrtPriceUp = tickToPrice(positionInfo.tickUpper)

    const roundUp = liquidityDelta > 0

    if (poolInfo.sqrtPrice <= sqrtPriceLow) {
        const amount0 = getAmount0Delta(sqrtPriceLow, sqrtPriceUp, abs(liquidityDelta), roundUp)
        const amount1 = 0
    } else if (sqrtPriceLow < poolInfo.sqrtPrice && poolInfo.sqrtPrice < sqrtPriceUp) {
        const amount0 = getAmount0Delta(poolInfo.sqrtPrice, sqrtPriceUp, abs(liquidityDelta), roundUp)
        const amount1 = getAmount1Delta(sqrtPriceLow, poolInfo.sqrtPrice, abs(liquidityDelta), roundUp)
    } else {
        const amount0 = 0
        const amount1 = getAmount1Delta(sqrtPriceLow, sqrtPriceUp, abs(liquidityDelta), roundUp)
    }

    const ownerAddress = getOwnerAddressOfPosition(positionsStore, positionID)
    if (liquidityDelta > 0) {
        transferToPool(TokenAPI, apiContext, ownerAddress, poolID, getToken0Id(poolID), amount0)
        transferToPool(TokenAPI, apiContext, ownerAddress, poolID, getToken1Id(poolID), amount1)
    } else {
        transferFromPool(TokenAPI, apiContext, poolID, ownerAddress, getToken0Id(poolID), amount0)
        transferFromPool(TokenAPI, apiContext, poolID, ownerAddress, getToken1Id(poolID), amount1)
    }


    if (sqrtPriceLow <= poolInfo.sqrtPrice && poolInfo.sqrtPrice < sqrtPriceUp) {
        poolInfo.liquidity += liquidityDelta
        poolsStore.set(poolID, poolInfo)
    }

    positionInfo.liquidity += liquidityDelta
    if (positionInfo.liquidity == 0) {
        positionsStore.delete(positionID)
    } else {
        positionsStore.set(positionID, positionInfo)
    }

    lowerTickInfo.liquidityNet += liquidityDelta
    upperTickInfo.liquidityNet -= liquidityDelta
    lowerTickInfo.liquidityGross += liquidityDelta
    upperTickInfo.liquidityGross += liquidityDelta

    if (lowerTickInfo.liquidityGross == 0) {
        priceTicksStore.delete(poolID, positionInfo.tickLower)
    } else {
        priceTicksStore.set(poolID, positionInfo.tickLower, lowerTickInfo)
    }

    if (upperTickInfo.liquidityGross == 0) {
        priceTicksStore.delete(poolID, positionInfo.tickUpper)
    } else {
        priceTicksStore.set(poolID, positionInfo.tickUpper, upperTickInfo)
    }

    return [amount0, amount1]
}




// Convert a hex string to a byte array
export const hexToBytes = (hex) => {
    const bytes: number[] = [];
    for (let c = 0; c < hex.length; c += 2)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        bytes.push(parseInt(hex.substr(c, 2), 16));
    return bytes;
}