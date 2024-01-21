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

import { MIN_TICK, MAX_TICK } from '../../../../../src/app/modules/dex/constants';
import { createPoolSchema } from '../../../../../src/app/modules/dex/schemas';
import { Fixtures } from './types';

const { utils } = cryptography;

const senderPublicKey = Buffer.from('0000000000000000', 'hex');
const signature = utils.getRandomBytes(64);
const tokenID0 = Buffer.from('0100000000', 'hex');
const tokenID1 = Buffer.from('1000000000', 'hex');
let randomTokenID = 1111111111;

const commonTransactionAttrs = {
	module: 'dex',
	command: 'createPool',
	fee: BigInt('5000000000000000000'),
	nonce: BigInt(0),
	senderPublicKey,
	signatures: [signature],
};

const commonParams = {
	tokenID0,
	tokenID1,
	feeTier: 100,
	tickInitialPrice: 1,
	initialPosition: {
		tickLower: MIN_TICK,
		tickUpper: MAX_TICK,
		amount0Desired: BigInt(1000),
		amount1Desired: BigInt(1000),
	},
	maxTimestampValid: BigInt(100000000000),
};

export const createPoolFixtures: Fixtures = [
	[
		'should be successful when all the parameters are correct',
		{
			...commonTransactionAttrs,
			params: codec.encode(createPoolSchema, {
				...commonParams,
			}),
		},
		false,
	],
	[
		'should fail when tokenID0 and tokenID1 are not sorted lexicographically',
		{
			...commonTransactionAttrs,
			params: codec.encode(createPoolSchema, {
				...commonParams,
				tokenID0: tokenID1,
				tokenID1: tokenID0,
			}),
		},
		'Please sort tokenID0 and tokenID1 lexicographically.',
	],
	[
		'should fail when amount0Desired or amount1Desired are zero',
		{
			...commonTransactionAttrs,
			params: codec.encode(createPoolSchema, {
				...commonParams,
				initialPosition: {
					tickLower: MIN_TICK,
					tickUpper: MAX_TICK,
					amount0Desired: BigInt(0),
					amount1Desired: BigInt(0),
				},
			}),
		},
		'Please specify amount0Desired or amount1Desired.',
	],
	[
		'should fail when tickLower and tickUpper do not meet requirements',
		{
			...commonTransactionAttrs,
			params: codec.encode(createPoolSchema, {
				...commonParams,
				initialPosition: {
					tickLower: MIN_TICK - 1,
					tickUpper: MAX_TICK + 1,
					amount0Desired: BigInt(1000),
					amount1Desired: BigInt(1000),
				},
			}),
		},
		'Please specify valid tick values.',
	],
	[
		'should fail when header.timestamp > maxTimestampValid',
		{
			...commonTransactionAttrs,
			params: codec.encode(createPoolSchema, {
				...commonParams,
				maxTimestampValid: BigInt(0),
			}),
		},
		'Current timestamp is over maxTimestampValid',
	],
];

export const createRandomPoolFixturesGenerator = (): Fixtures => {
	randomTokenID -= 1;
	return [
		[
			'should be successful with random tokenIDs',
			{
				...commonTransactionAttrs,
				params: codec.encode(createPoolSchema, {
					...commonParams,
					tokenID0: Buffer.from(randomTokenID.toString(), 'hex'),
					tokenID1: Buffer.from(randomTokenID.toString(), 'hex'),
				}),
			},
			false,
		],
	];
};
