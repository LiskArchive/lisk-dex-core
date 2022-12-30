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

import { RandomMethod, TokenMethod } from 'lisk-sdk';
import { MODULE_NAME_DEX } from '../../dex/constants';
import {
	ADDRESS_VALIDATOR_INCENTIVES,
	TOKEN_ID_LSK,
	INCENTIVE_REDUCTION_SEED_REVEAL,
	BLOCK_INCENTIVE_VALIDATORS,
	INCENTIVE_REDUCTION_FACTOR_BFT,
	INCENTIVE_REDUCTION_MAX_PREVOTES,
	INCENTIVE_NO_REDUCTION,
} from '../constants';
import { ValidatorTradeIncentivesPayoutEvent } from '../events';

export const transferValidatorLSKIncentives = async (
	validators,
	methodContext,
	tokenMethod: TokenMethod,
	events,
) => {
	const availableIncentives = await tokenMethod.getLockedAmount(
		methodContext,
		ADDRESS_VALIDATOR_INCENTIVES,
		TOKEN_ID_LSK,
		MODULE_NAME_DEX,
	);
	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	const shareAmount = BigInt(availableIncentives) / BigInt(validators.length);
	if (shareAmount !== BigInt(0)) {
		await tokenMethod.unlock(
			methodContext,
			ADDRESS_VALIDATOR_INCENTIVES,
			MODULE_NAME_DEX,
			TOKEN_ID_LSK,
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			shareAmount * BigInt(validators.length),
		);

		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
		await validators.forEach(async validator => {
			await tokenMethod.transfer(
				methodContext,
				ADDRESS_VALIDATOR_INCENTIVES,
				validator,
				TOKEN_ID_LSK,
				shareAmount,
			);

			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
			events.get(ValidatorTradeIncentivesPayoutEvent).add(
				methodContext,
				{
					amount: shareAmount,
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					validatorAddress: validator,
				},
				[validator],
			);
		});
	}
};

export const getValidatorBlockIncentive = async (
	methodContext,
	randomMethod: RandomMethod,
	blockHeader,
	impliesMaximalPrevotes,
): Promise<[bigint, number]> => {
	if (
		!(await randomMethod.isSeedRevealValid(
			methodContext,
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			blockHeader.generatorAddress,
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			blockHeader.seedReveal,
		))
	) {
		return [BigInt(0), INCENTIVE_REDUCTION_SEED_REVEAL];
	}

	// eslint-disable-next-line @typescript-eslint/no-unsafe-call
	if (!impliesMaximalPrevotes) {
		return [BLOCK_INCENTIVE_VALIDATORS / INCENTIVE_REDUCTION_FACTOR_BFT, INCENTIVE_REDUCTION_MAX_PREVOTES];
	}
	return [BLOCK_INCENTIVE_VALIDATORS, INCENTIVE_NO_REDUCTION];
};
