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

import { addLiquiditySchema } from '../../../../../src/app/modules/dex/schemas';
import { Fixtures } from './types';

const { utils } = cryptography;

const senderPublicKey = Buffer.from('a2badd91e7ed423b56322b68f2beee4c638f0506', 'hex');
const signature = utils.getRandomBytes(64);
const positionID = Buffer.from('0000000100', 'hex');

const commonTransactionAttrs = {
	module: 'dex',
	command: 'addLiquidity',
	fee: BigInt(5000000),
	nonce: BigInt(0),
	senderPublicKey,
	signatures: [signature],
};

const commonParams = {
	positionID,
	amount0Desired: BigInt(1000),
	amount1Desired: BigInt(1000),
	amount0Min: BigInt(0),
	amount1Min: BigInt(0),
	maxTimestampValid: BigInt(100000000000),
};
export const addLiquidityFixtures: Fixtures = [
	[
		'should be successful when all the parameters are correct',
		{
			...commonTransactionAttrs,
			params: codec.encode(addLiquiditySchema, {
				...commonParams,
			}),
		},
		false,
	],
	[
		'should fail when amount0Min > amount0Desired',
		{
			...commonTransactionAttrs,
			params: codec.encode(addLiquiditySchema, {
				...commonParams,
				amount0Desired: BigInt(999),
				amount0Min: BigInt(1000),
			}),
		},
		'Please specify valid amounts',
	],
	[
		'should fail when header.timestamp > maxTimestampValid',
		{
			...commonTransactionAttrs,
			params: codec.encode(addLiquiditySchema, {
				...commonParams,
				maxTimestampValid: BigInt(0),
			}),
		},
		'Current timestamp is over maxTimestampValid',
	],
];
