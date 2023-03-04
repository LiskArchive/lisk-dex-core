/* eslint-disable import/no-cycle */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable  @typescript-eslint/no-floating-promises */
/* eslint-disable  @typescript-eslint/no-inferrable-types */
/* eslint-disable  @typescript-eslint/require-await */
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

import { PoSMethod, TokenMethod } from 'lisk-sdk';
import { MODULE_NAME_DEX } from '../../dex/constants';
import { divQ96, mulQ96, numberToQ96, roundDownQ96 } from '../../dex/utils/q96';
import {
	ADDRESS_VALIDATOR_INCENTIVES,
	TOKEN_ID_LSK,
	EPOCH_LENGTH_INCENTIVE_REDUCTION,
} from '../constants';
import { ValidatorIncentivesPayout } from '../events';
import { Address } from '../types';

export const transferAllValidatorLSKIncentives = async (
	validators,
	methodContext,
	tokenMethod: TokenMethod,
	posMethod: PoSMethod,
	events,
) => {
	let availableIncentives = await tokenMethod.getLockedAmount(
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
			availableIncentives,
		);

		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
		let totalWeight = BigInt(0);
		const standByShare = Math.floor(Number(availableIncentives / BigInt(validators.length)));
		await validators.forEach(async validator => {
			totalWeight += validator.bftWeight;
			if (validator.bftWeight === BigInt(0)) {
				await transferValidatorIncentives(
					methodContext,
					tokenMethod,
					posMethod,
					validator.address,
					BigInt(standByShare),
					events,
				);
				availableIncentives -= BigInt(standByShare);
			}
		});
		const incentivePerBFTWeight = divQ96(
			numberToQ96(availableIncentives),
			numberToQ96(totalWeight),
		);
		await validators.forEach(async validator => {
			if (validator.bftWeight !== BigInt(0)) {
				const share = roundDownQ96(mulQ96(incentivePerBFTWeight, numberToQ96(validator.bftWeight)));
				await transferValidatorIncentives(
					methodContext,
					tokenMethod,
					posMethod,
					validator.address,
					share,
					events,
				);
				availableIncentives -= share;
			}
		});
		tokenMethod.lock(
			methodContext,
			ADDRESS_VALIDATOR_INCENTIVES,
			MODULE_NAME_DEX,
			TOKEN_ID_LSK,
			availableIncentives,
		);
	}
};

export const transferValidatorIncentives = async (
	methodContext,
	tokenMethod: TokenMethod,
	posMethod: PoSMethod,
	validatorAddress: Address,
	amount: bigint,
	events,
) => {
	tokenMethod.transfer(
		methodContext,
		ADDRESS_VALIDATOR_INCENTIVES,
		validatorAddress,
		TOKEN_ID_LSK,
		amount,
	);
	posMethod.updateSharedRewards(methodContext, validatorAddress, TOKEN_ID_LSK, amount);
	events.get(ValidatorIncentivesPayout).add(methodContext, {
		amount: amount,
	});
};

export const getLiquidityIncentivesAtHeight = (height: number): bigint => {
	if (height < EPOCH_LENGTH_INCENTIVE_REDUCTION) {
		return BigInt('400000000');
	}
	if (height < BigInt(2) * EPOCH_LENGTH_INCENTIVE_REDUCTION) {
		return BigInt('350000000');
	}
	if (height < BigInt(3) * EPOCH_LENGTH_INCENTIVE_REDUCTION) {
		return BigInt('300000000');
	}
	if (height < BigInt(4) * EPOCH_LENGTH_INCENTIVE_REDUCTION) {
		return BigInt('250000000');
	}
	return BigInt('200000000');
};

export const getLPIncentiveInRange = (startHeight: number, endHeight: number): BigInt => {
	if (endHeight < startHeight) {
		throw new Error();
	}

	const EPOCHS = [
		EPOCH_LENGTH_INCENTIVE_REDUCTION,
		BigInt(2) * EPOCH_LENGTH_INCENTIVE_REDUCTION,
		BigInt(3) * EPOCH_LENGTH_INCENTIVE_REDUCTION,
		BigInt(4) * EPOCH_LENGTH_INCENTIVE_REDUCTION,
	];

	let height: bigint = BigInt(startHeight + 1); // incentive for the start block are excluded
	let incentives: bigint = BigInt(0);
	EPOCHS.forEach(changeHeight => {
		if (changeHeight > startHeight && changeHeight < endHeight) {
			incentives +=
				(changeHeight - BigInt(height)) * getLiquidityIncentivesAtHeight(Number(height));
			height = changeHeight;
		}
	});

	incentives += (BigInt(endHeight) - height) * getLiquidityIncentivesAtHeight(Number(height));
	incentives += getLiquidityIncentivesAtHeight(endHeight);

	return incentives;
};
