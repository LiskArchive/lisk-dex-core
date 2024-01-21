/* eslint-disable @typescript-eslint/no-unsafe-argument */
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
import { cryptography } from 'lisk-sdk';
import { TextEncoder } from 'util';

const { address } = cryptography;

// Convert a hex string to a byte array
export const hexToBytes = hex => {
	const bytes: number[] = [];
	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	for (let c = 0; c < hex.length; c += 2)
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
		bytes.push(parseInt(hex.substr(c, 2), 16));
	return bytes;
};

export const sha256 = input => {
	const inputBytes = new TextEncoder().encode(input);
	return createHash('sha256').update(inputBytes).digest();
};

export const MODULE_NAME_DEX_INCENTIVES = 'dexIncentives'; // Name of the DEX Incentives module.
export const MODULE_NAME_DEX = 'dex'; // Name of the DEX module, as defined in the DEX module.
export const NUM_BYTES_ADDRESS = 20; // The number of bytes of an address.

// The address of the liquidity provider incentives pool, as defined in the DEX module.
export const ADDRESS_LIQUIDITY_PROVIDER_INCENTIVES = address.getAddressFromLisk32Address(
	'lskgn7m77b769frqvgq7uko74wcrroqtcjv7nhv95',
); // Buffer.from(
// 	sha256('liquidityProviderIncentivesAccount'),
// ).slice(0, NUM_BYTES_ADDRESS);

// The address of the trader incentives pool, as defined in the DEX module.
export const ADDRESS_TRADER_INCENTIVES = Buffer.from(sha256('traderIncentivesAcount')).slice(
	0,
	NUM_BYTES_ADDRESS,
);

// The address of the validator incentives pool, as defined in the DEX module.
export const ADDRESS_VALIDATOR_INCENTIVES = Buffer.from(sha256('validatorIncentivesAccount')).slice(
	0,
	NUM_BYTES_ADDRESS,
);

export const TOKEN_ID_DEX_NATIVE = Buffer.from('0400001100000000', 'hex'); // Token ID of the native token of DEX sidechain.
export const TOKEN_ID_LSK = Buffer.from('0400000000000000', 'hex'); // Token ID of the LSK token.
export const EVENT_NAME_VALIDATOR_TRADE_INCENTIVES_PAYOUT = 'validatorTradeIncentivesPayout'; // Name of the validator trade incentives payout event.
export const EVENT_NAME_GENERATOR_INCENTIVES_PAYOUT = 'generatorIncentivesPayout'; // Name of the generator incentives payout event.
export const INCENTIVE_NO_REDUCTION = 0; // Return code for no block incentive reduction.
export const INCENTIVE_REDUCTION_SEED_REVEAL = 1; // Return code for block incentive reduction because of the failed seed reveal.
export const INCENTIVE_REDUCTION_MAX_PREVOTES = 2; // Return code for block incentive reduction because the block header does not imply the maximal number of prevotes.
export const INCENTIVE_REDUCTION_FACTOR_BFT = BigInt(4); // The reduction factor for validator block incentive in case when the block header does not imply the maximal number of prevotes.
export const LENGTH_EPOCH_REWARDS_INCENTIVES = BigInt('3153600'); // The duration of the epoch after which liquidity incentives decrease
export const BOOTSTRAP_PERIOD_OFFSET = BigInt('259975'); // The height of the first block after the bootstrap period.
export const EVENT_NAME_VALIDATOR_INCENTIVES_PAYOUT = 'validatorIncentivesPayout';
export const BLOCK_INCENTIVE_LIQUIDITY_PROVIDERS = BigInt('90000000'); // Amount of liquidity provider rewards per block, in DEX native token.
export const BLOCK_INCENTIVE_TRADERS = BigInt('60000000'); // Amount of trader rewards per block, in DEX native token.
export const BLOCK_INCENTIVE_VALIDATORS = BigInt('150000000'); // Amount of validator rewards per block, in DEX native token.
export const EVENT_NAME_VALIDATOR_TRADE_REWARDS_PAYOUT = 'validatorTradeRewardsPayout'; // Name of the validator trade rewards payout event.
export const EVENT_NAME_GENERATOR_REWARDS_PAYOUT = 'generatorRewardsPayout'; // Name of the generator rewards payout event.

export const defaultConfig = {};
