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

import {
	MIN_SQRT_RATIO,
	MAX_SQRT_RATIO,
	STORE_PREFIX_POOL,
	GENESIS_BLOCK_TIMESTAMP,
	GENESIS_BLOCK_VERSION,
	NUM_INIT_ROUNDS,
	NUM_BOOTSTRAP_VALIDATORS,
	MODULE_NAME_DEX,
	MODULE_NAME_POS,
	MODULE_NAME_TOKEN,
	ADDRESS_LENGTH,
	// TOKEN_ID_DEX,
	ALL_SUPPORTED_TOKENS_KEY,
	ADDRESS_VALIDATOR_INCENTIVES,
	ED25519_PUBLIC_KEY_LENGTH,
	BLS_PUBLIC_KEY_LENGTH,
	BLS_POP_LENGTH,
	// CHAIN_ID,
	MAX_TRANSACTIONS_SIZE_BYTES,
	MAX_ASSET_DATA_SIZE_BYTES,
	BLOCK_TIME,
	LSK_BFT_BATCH_SIZE,
	MAX_PARAMS_SIZE,
	LOCKING_PERIOD_STAKING,
	PUNISHMENT_WINDOW_STAKING,
	TOKEN_ID_POS,
	BOOTSTRAP_PERIOD_OFFSET,
} from '../../../../src/app/modules/dex/constants';

describe('dex:constants', () => {
	it('should have the constants defined', () => {
		expect(MIN_SQRT_RATIO).toBe(BigInt(4295128735));
		expect(MAX_SQRT_RATIO).toBe(BigInt('1461446704550679960896629428549052887957817041882'));
		expect(STORE_PREFIX_POOL).toStrictEqual(Buffer.from('0000', 'hex'));

		expect(GENESIS_BLOCK_VERSION).toBe(0);
		expect(GENESIS_BLOCK_TIMESTAMP).toBe(0);
		expect(NUM_INIT_ROUNDS).toBe(2574);
		expect(NUM_BOOTSTRAP_VALIDATORS).toBe(101);
		expect(MODULE_NAME_DEX).toBe('dex');
		expect(MODULE_NAME_POS).toBe('pos');
		expect(MODULE_NAME_TOKEN).toBe('token');
		expect(ADDRESS_LENGTH).toBe(20);
		// expect(TOKEN_ID_DEX).toBe(Buffer.from('0000', 'hex'));
		expect(ALL_SUPPORTED_TOKENS_KEY).toEqual(Buffer.from('', 'hex'));

		expect(ADDRESS_VALIDATOR_INCENTIVES).toEqual(
			Buffer.from('760799bbccac2a03617a9561c47256a806b522bb', 'hex'),
		);
		expect(ED25519_PUBLIC_KEY_LENGTH).toBe(32);
		expect(BLS_PUBLIC_KEY_LENGTH).toBe(48);
		expect(BLS_POP_LENGTH).toBe(96);

		// expect(CHAIN_ID).toBe(Buffer.from('0000', 'hex'));
		expect(MAX_TRANSACTIONS_SIZE_BYTES).toBe(15360);
		expect(MAX_ASSET_DATA_SIZE_BYTES).toBe(18);
		expect(BLOCK_TIME).toBe(10);
		expect(LSK_BFT_BATCH_SIZE).toBe(103);
		expect(MAX_PARAMS_SIZE).toBe(14336);

		expect(LOCKING_PERIOD_STAKING).toBe(260000);
		expect(PUNISHMENT_WINDOW_STAKING).toBe(780000);
		expect(TOKEN_ID_POS).toEqual(Buffer.from('0000000100000001', 'hex'));
		expect(BOOTSTRAP_PERIOD_OFFSET).toBe(259975);
	});
});
