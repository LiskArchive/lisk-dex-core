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

import { codec, cryptography } from 'lisk-sdk';
import { MAX_TICK, MIN_TICK } from '../../../../../src/app/modules/dex/constants';

import { createPositionSchema } from '../../../../../src/app/modules/dex/schemas';
import { Fixtures } from './types';

const { utils } = cryptography;

const senderPublicKey = Buffer.from('0000000000000000', 'hex');
const signature = utils.getRandomBytes(64);
const poolID = Buffer.from('0000000100000000010164000000', 'hex');

const commonTransactionAttrs = {
	module: 'dex',
	command: 'createPosition',
	fee: BigInt(5000000),
	nonce: BigInt(0),
	senderPublicKey,
	signatures: [signature],
};

const commonParams = {
	poolID,
	tickLower: MIN_TICK + 100,
	tickUpper: MAX_TICK - 100,
	amount0Desired: BigInt(1000),
	amount1Desired: BigInt(1000),
	amount0Min: BigInt(0),
	amount1Min: BigInt(0),
	maxTimestampValid: BigInt(100000000000),
};

export const createPositionFixtures: Fixtures = [
	[
		'should be successful when all the parameters are correct',
		{
			...commonTransactionAttrs,
			params: codec.encode(createPositionSchema, {
				...commonParams,
			}),
		},
		false,
	],
	[
		'should fail when ticks are invalid',
		{
			...commonTransactionAttrs,
			params: codec.encode(createPositionSchema, {
				...commonParams,
				tickLower: MAX_TICK,
				tickUpper: MIN_TICK,
			}),
		},
		'Please specify valid tick values',
	],
	[
		'should fail when amount0Desired is over amount0Min',
		{
			...commonTransactionAttrs,
			params: codec.encode(createPositionSchema, {
				...commonParams,
				amount0Desired: BigInt(1000),
				amount0Min: BigInt(1001),
			}),
		},
		'Please specify valid amounts',
	],
	[
		'should fail when header.timestamp > maxTimestampValid',
		{
			...commonTransactionAttrs,
			params: codec.encode(createPositionSchema, {
				...commonParams,
				maxTimestampValid: BigInt(0),
			}),
		},
		'Current timestamp is over maxTimestampValid',
	],
];
