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
	BaseCommand,
	CommandVerifyContext,
	VerificationResult,
	CommandExecuteContext,
	TokenMethod,
	VerifyStatus,
} from 'lisk-sdk';
import { validator } from '@liskhq/lisk-validator';
import { collectFeesSchema } from '../schemas';
import {
	checkPositionExistenceAndOwnership,
	collectFeesAndIncentives,
} from '../utils/auxiliaryFunctions';
import { COMMAND_ID_COLLECT_FEES, MAX_NUM_POSITIONS_FEE_COLLECTION } from '../constants';
import { CollectFeesParamData } from '../types';

export class CollectFeesCommand extends BaseCommand {
	public id = COMMAND_ID_COLLECT_FEES;
	public schema = collectFeesSchema;

	private _tokenMethod!: TokenMethod;

	public init({ tokenMethod }): void {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		this._tokenMethod = tokenMethod;
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	public async verify(
		ctx: CommandVerifyContext<CollectFeesParamData>,
	): Promise<VerificationResult> {
		try {
			validator.validate(collectFeesSchema, ctx.params);
		} catch (err) {
			return {
				status: VerifyStatus.FAIL,
				error: err as Error,
			};
		}
		const { positions } = ctx.params;

		if (positions.length > MAX_NUM_POSITIONS_FEE_COLLECTION) {
			return {
				status: VerifyStatus.FAIL,
				error: new Error('Please enter the correct positions'),
			};
		}

		return {
			status: VerifyStatus.OK,
		};
	}

	public async execute(ctx: CommandExecuteContext<CollectFeesParamData>): Promise<void> {
		const senderAddress = ctx.transaction.senderPublicKey;

		const { positions } = ctx.params;

		const methodContext = ctx.getMethodContext();

		for (const positionID of positions) {
			await checkPositionExistenceAndOwnership(
				this.stores,
				this.events,
				methodContext,
				senderAddress,
				positionID,
			);
			await collectFeesAndIncentives(
				this.events,
				this.stores,
				this._tokenMethod,
				methodContext,
				positionID,
			);
		}
	}
}
