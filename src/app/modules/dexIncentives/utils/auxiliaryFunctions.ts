/* eslint-disable @typescript-eslint/no-unsafe-argument */
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

import { TokenMethod } from 'lisk-sdk';
import { MODULE_NAME_DEX } from '../../dex/constants';
import { divQ96, mulQ96, roundDownQ96 } from '../../dex/utils/q96';
import {
	ADDRESS_VALIDATOR_INCENTIVES,
	TOKEN_ID_LSK,
} from '../constants';
import { ValidatorTradeIncentivesPayoutEvent } from '../events';
import { Address } from '../types';

export const transferAllValidatorLSKIncentives = async (
	validators,
	methodContext,
	tokenMethod: TokenMethod,
) => {
	const availableIncentives = await tokenMethod.getLockedAmount(
		methodContext,
		ADDRESS_VALIDATOR_INCENTIVES,
		TOKEN_ID_LSK,
		MODULE_NAME_DEX,
	);
	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	if (availableIncentives !== BigInt(0)) {
		await tokenMethod.unlock(
			methodContext,
			ADDRESS_VALIDATOR_INCENTIVES,
			MODULE_NAME_DEX,
			TOKEN_ID_LSK,
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			availableIncentives
		);

		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
		let totalWeight = BigInt(0);
		const standByShare = availableIncentives / BigInt(validators.length);
		await validators.forEach(async validator => {
			totalWeight += validator.bftWeight;
			if (validator.bftWeight === BigInt(0)) {
				await tokenMethod.transfer(
					methodContext,
					ADDRESS_VALIDATOR_INCENTIVES,
					validator,
					TOKEN_ID_LSK,
					standByShare
				);
			}
		});
		const incentivePerBFTWeight = divQ96(availableIncentives, totalWeight);
		await validators.forEach(async validator => {
			if (validator.bftWeight !== BigInt(0)) {
				const share = roundDownQ96(mulQ96(incentivePerBFTWeight, validator.bftWeight));
				await tokenMethod.transfer(
					methodContext,
					ADDRESS_VALIDATOR_INCENTIVES,
					validator,
					TOKEN_ID_LSK,
					share
				);
			}
		});
		tokenMethod.unlock(
			methodContext,
			ADDRESS_VALIDATOR_INCENTIVES,
			MODULE_NAME_DEX,
			TOKEN_ID_LSK,
			availableIncentives
		);
	}
};

export const transferValidatorIncentives = async (
	methodContext,
	tokenMethod: TokenMethod,
	validatorAddress: Address,
	amount: bigint,
	events
) => {
	tokenMethod.transfer(
		methodContext,
		ADDRESS_VALIDATOR_INCENTIVES,
		validatorAddress,
		TOKEN_ID_LSK,
		amount
	);
	events.get(ValidatorTradeIncentivesPayoutEvent).add(
		methodContext,
		{
			"amount": amount
		},
	);
};
