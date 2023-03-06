/* eslint-disable @typescript-eslint/no-unsafe-argument */
/*
 * Copyright © 2020 Lisk Foundation
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
export const ADDRESS_LIQUIDITY_PROVIDER_INCENTIVES = Buffer.from(
	sha256('liquidityProviderIncentivesAccount'),
).slice(0, NUM_BYTES_ADDRESS);

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

export const TOKEN_ID_DEX_NATIVE = Buffer.from(hexToBytes('0x0000000100000001')); // Token ID of the native token of DEX sidechain.
export const TOKEN_ID_LSK = Buffer.from(hexToBytes('0x0000000100000000')); // Token ID of the LSK token.
export const EVENT_NAME_VALIDATOR_TRADE_INCENTIVES_PAYOUT = 'validatorTradeIncentivesPayout'; // Name of the validator trade incentives payout event.
export const EVENT_NAME_GENERATOR_INCENTIVES_PAYOUT = 'generatorIncentivesPayout'; // Name of the generator incentives payout event.
export const INCENTIVE_NO_REDUCTION = 0; // Return code for no block incentive reduction.
export const INCENTIVE_REDUCTION_SEED_REVEAL = 1; // Return code for block incentive reduction because of the failed seed reveal.
export const INCENTIVE_REDUCTION_MAX_PREVOTES = 2; // Return code for block incentive reduction because the block header does not imply the maximal number of prevotes.
export const INCENTIVE_REDUCTION_FACTOR_BFT = BigInt(4); // The reduction factor for validator block incentive in case when the block header does not imply the maximal number of prevotes.
export const EPOCH_LENGTH_INCENTIVE_REDUCTION = BigInt('30000000'); // The duration of the epoch after which liquidity incentives decrease
export const EVENT_NAME_VALIDATOR_INCENTIVES_PAYOUT = 'validatorIncentivesPayout';

export const defaultConfig = {};
