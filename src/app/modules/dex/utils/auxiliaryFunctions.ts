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
    TokenAPI
} from 'lisk-sdk';

import {
    utils
} from '@liskhq/lisk-cryptography';

import {
    NUM_BYTES_ADDRESS,
    NUM_BYTES_TOKEN_ID,
    NUM_BYTES_POSITION_ID,
    MODULE_ID_DEX
} from '../constants';

import {
    uint32beInv
} from "./bigEndian";

import {
    PoolID,
    PositionID,
    Address,
    TokenID,
    ModuleConfig
} from "../types";

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

// Convert a hex string to a byte array
export const hexToBytes = (hex) => {
    const bytes: number[] = [];
    for (let c = 0; c < hex.length; c += 2)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        bytes.push(parseInt(hex.substr(c, 2), 16));
    return bytes;
}