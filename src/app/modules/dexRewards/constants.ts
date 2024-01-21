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

import { createHash } from 'crypto';
import { TextEncoder } from 'util';

// Convert a hex string to a byte array
export const hexToBytes = (hex: string) => {
	const bytes: number[] = [];
	for (let c = 0; c < hex.length; c += 2) bytes.push(parseInt(hex.substr(c, 2), 16));
	return bytes;
};

export const sha256 = (input: string) => {
	const inputBytes = new TextEncoder().encode(input);
	return createHash('sha256').update(inputBytes).digest();
};

export const MODULE_NAME_DEX_REWARDS = 'dexRewards'; // Name of the DEX Rewards module.
export const MODULE_NAME_DEX = 'dex'; // Name of the DEX module, as defined in the DEX module.
export const NUM_BYTES_ADDRESS = 20; // The number of bytes of an address.

// The address of the liquidity provider rewards pool, as defined in the DEX module.
export const ADDRESS_LIQUIDITY_PROVIDER_REWARDS_POOL = Buffer.from(
	sha256('liquidityProviderRewardsPool'),
).slice(0, NUM_BYTES_ADDRESS);

// The address of the trader rewards pool, as defined in the DEX module.
export const ADDRESS_TRADER_REWARDS_POOL = Buffer.from(sha256('traderRewardsPool')).slice(
	0,
	NUM_BYTES_ADDRESS,
);

// The address of the validator rewards pool, as defined in the DEX module.
export const ADDRESS_VALIDATOR_REWARDS_POOL = Buffer.from(sha256('validatorRewardsPool')).slice(
	0,
	NUM_BYTES_ADDRESS,
);

export const TOKEN_ID_DEX = Buffer.from(hexToBytes('0x0000000100000001')); // Token ID of the native token of DEX sidechain.
export const TOKEN_ID_LSK = Buffer.from(hexToBytes('0x0000000100000000')); // Token ID of the LSK token.
export const BLOCK_REWARD_LIQUIDITY_PROVIDERS = BigInt('90000000'); // Amount of liquidity provider rewards per block, in DEX native token.
export const BLOCK_REWARD_TRADERS = BigInt('60000000'); // Amount of trader rewards per block, in DEX native token.
export const BLOCK_REWARD_VALIDATORS = BigInt('150000000'); // Amount of validator rewards per block, in DEX native token.
export const EVENT_NAME_VALIDATOR_TRADE_REWARDS_PAYOUT = 'validatorTradeRewardsPayout'; // Name of the validator trade rewards payout event.
export const EVENT_NAME_GENERATOR_REWARDS_PAYOUT = 'generatorRewardsPayout'; // Name of the generator rewards payout event.
export const REWARD_NO_REDUCTION = 0; // Return code for no block reward reduction.
export const REWARD_REDUCTION_SEED_REVEAL = 1; // Return code for block reward reduction because of the failed seed reveal.
export const REWARD_REDUCTION_MAX_PREVOTES = 2; // Return code for block reward reduction because the block header does not imply the maximal number of prevotes.
export const REWARD_REDUCTION_FACTOR_BFT = BigInt(4); // The reduction factor for validator block reward in case when the block header does not imply the maximal number of prevotes.

export const defaultConfig = {};
