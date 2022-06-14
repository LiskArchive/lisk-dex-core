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

import {cryptography} from 'lisk-sdk';
import { NUM_BYTES_ADDRESS, NUM_BYTES_TOKEN_ID, NUM_BYTES_POSITION_ID } from '../constants';
import { uint32beInv } from "./bigEndian";
import { PoolID, TokenID, PositionID, Address } from "../types";

export const poolIdToAddress = (poolId: PoolID): Address =>  {  
    const _address:Buffer = cryptography.hash(poolId);
    return _address.slice(0, NUM_BYTES_ADDRESS);    //truncate SHA256(poolId) to first (8*NUM_BYTES_ADDRESS) bits
}

export const getToken0Id = (poolId: PoolID): TokenID => {
    return poolId.slice(0, NUM_BYTES_TOKEN_ID);
}

export const getToken1Id = (poolId: PoolID): TokenID => {
    return poolId.slice(NUM_BYTES_TOKEN_ID, 2*NUM_BYTES_TOKEN_ID);
}

export const getFeeTier = (poolId: PoolID): number => {
    const _buffer: Buffer = poolId.slice(2*NUM_BYTES_TOKEN_ID, NUM_BYTES_ADDRESS);
    const _hexBuffer: string = _buffer.toString('hex');

    return uint32beInv(_hexBuffer); //returns type uint32
}

export const getNFTIndex = (positionId: PositionID): Buffer => {
    return positionId.slice(NUM_BYTES_POSITION_ID-8, NUM_BYTES_POSITION_ID) //last 8 bytes of positionId
}

export const transferToPool = (senderAddress: Address, poolId: PoolID, tokenId: TokenID, amount: number): void => {
    
    const poolAddress: Address = poolIdToAddress(poolId);

    //TO DO
    //Token.transfer(senderAddress, poolAddress, tokenID, amount)
    //Token.lock(poolAddress, MODULE_ID_DEX, tokenID, amount)

}

export const transferFromPool = (poolId: PoolID, recipientAddress: Address, tokenId: TokenID, amount: number): void => {
    const poolAddress: Address = poolIdToAddress(poolId)
    
    //TO DO
    //Token.unlock(poolAddress, MODULE_ID_DEX, tokenID, amount)
    //Token.transfer(poolAddress, recipientAddress, tokenID, amount)
}

export const transferPoolToPool = (poolIdSend: PoolID, poolIdReceive: PoolID, tokenId: TokenID, amount: number): void => {
    const poolAddressSend: Address = poolIdToAddress(poolIdSend)
    const poolAddressReceive: Address = poolIdToAddress(poolIdReceive)
    //Token.unlock(poolAddressSend, MODULE_ID_DEX, tokenID, amount)
    //Token.transfer(poolAddressSend, poolAddressReceive, tokenID, amount)
    //Token.lock(poolAddressReceive, MODULE_ID_DEX, tokenID, amount)
}

export const transferToProtocolFeeAccount = (senderAddress: Address, tokenId: TokenID, amount: number): void => {
    //Token.transfer(senderAddress, settings.protocolFeeAddress, tokenId, amount)
}