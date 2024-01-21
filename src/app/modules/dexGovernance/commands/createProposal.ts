/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-misused-promises */
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
	CommandExecuteContext,
	CommandVerifyContext,
	VerificationResult,
	VerifyStatus,
	TokenMethod,
	FeeMethod,
	PoSMethod,
} from 'lisk-sdk';

import { IndexStore, ProposalsStore } from '../stores';
import { CreateProposalParamsData } from '../types';
import { emitProposalCreationFailedEvent, hasEnded } from '../utils/auxiliaryFunctions';
import { sha256 } from '../../dexRewards/constants';
import { DexModule } from '../../dex/module';
import { DexEndpoint } from '../../dex/endpoint';
import { numberToQ96, q96ToBytes } from '../../dex/utils/q96';
import { ProposalCreatedEvent, ProposalCreationFailedEvent } from '../events';
import { createProposalParamsSchema } from '../schemas';
import {
	FEE_PROPOSAL_CREATION,
	LENGTH_ADDRESS,
	MAX_NUM_RECORDED_VOTES,
	MINIMAL_BALANCE_PROPOSE,
	PROPOSAL_STATUS_ACTIVE,
	PROPOSAL_TYPE_INCENTIVIZATION,
	PROPOSAL_TYPE_UNIVERSAL,
	TOKEN_ID_DEX,
	VOTE_DURATION,
} from '../constants';
import { COMMAND_CREATE_PROPOSAL, NUM_BYTES_POOL_ID } from '../../dex/constants';

export class CreateProposalCommand extends BaseCommand {
	public id = COMMAND_CREATE_PROPOSAL;
	public schema = createProposalParamsSchema;
	private _tokenMethod!: TokenMethod;
	private _posMethod!: PoSMethod;
	private _feeMethod!: FeeMethod;

	public addDependencies({ tokenMethod, posMethod, feeMethod }) {
		this._tokenMethod = tokenMethod;
		this._posMethod = posMethod;
		this._feeMethod = feeMethod;
	}

	public init({ tokenMethod, posMethod, feeMethod }): void {
		this._tokenMethod = tokenMethod;
		this._posMethod = posMethod;
		this._feeMethod = feeMethod;
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	public async verify(
		ctx: CommandVerifyContext<CreateProposalParamsData>,
	): Promise<VerificationResult> {
		const senderAddress = sha256(ctx.transaction.senderPublicKey.toString()).slice(
			0,
			LENGTH_ADDRESS,
		);

		const methodContext = ctx.getMethodContext();

		const availableBalance = await this._tokenMethod.getAvailableBalance(
			methodContext,
			senderAddress,
			TOKEN_ID_DEX,
		);

		const lockedBalance = await this._posMethod.getLockedStakedAmount(methodContext, senderAddress);

		if (availableBalance + lockedBalance < MINIMAL_BALANCE_PROPOSE) {
			return {
				status: VerifyStatus.FAIL,
				error: new Error('Insufficient DEX native token balance to create proposal'),
			};
		}
		if (availableBalance < FEE_PROPOSAL_CREATION) {
			return {
				status: VerifyStatus.FAIL,
				error: new Error('Insufficient balance to pay proposal creation fee'),
			};
		}
		const { type, content } = ctx.params;
		if (type === PROPOSAL_TYPE_INCENTIVIZATION) {
			if (content.poolID.length !== NUM_BYTES_POOL_ID) {
				return {
					status: VerifyStatus.FAIL,
					error: new Error('Pool ID must be provided for an incentivization proposal'),
				};
			}
		} else if (type === PROPOSAL_TYPE_UNIVERSAL) {
			if (content.text.length === 0) {
				return {
					status: VerifyStatus.FAIL,
					error: new Error('Proposal text can not be empty for universal proposal'),
				};
			}
			if (content.poolID.length !== 0 || content.multiplier !== 0) {
				return {
					status: VerifyStatus.FAIL,
					error: new Error(
						'For universal proposals, pool ID must be empty and multiplier must be set to 0',
					),
				};
			}
		} else {
			return {
				status: VerifyStatus.FAIL,
				error: new Error('Invalid Proposal Type'),
			};
		}
		return {
			status: VerifyStatus.OK,
		};
	}

	public async execute(ctx: CommandExecuteContext<CreateProposalParamsData>): Promise<void> {
		const senderAddress = sha256(ctx.transaction.senderPublicKey.toString()).slice(
			0,
			LENGTH_ADDRESS,
		);
		const dexModule = new DexModule();
		const endpoint = new DexEndpoint(this.stores, dexModule.offchainStores);
		const methodContext = ctx.getMethodContext();

		const indexStore = this.stores.get(IndexStore);
		const indexStoreData = await indexStore.get(methodContext, Buffer.from('0'));
		const hasEndedRes = await hasEnded(
			methodContext,
			this.stores.get(ProposalsStore),
			indexStoreData.newestIndex - MAX_NUM_RECORDED_VOTES + 1,
			ctx.header.height,
			VOTE_DURATION,
		);

		if (!hasEndedRes) {
			emitProposalCreationFailedEvent(methodContext, 0, this.events);
			throw new Error('Limit of proposals with recoded votes is reached');
		}

		try {
			await endpoint.getPool(methodContext, ctx.params.content.poolID);
		} catch (error) {
			this.events.get(ProposalCreationFailedEvent).add(methodContext, {
				reason: 1,
			});
			throw new Error('PoolID does not exist');
		}

		if (!(await endpoint.getPool(methodContext, ctx.params.content.poolID))) {
			if (ctx.params.type === PROPOSAL_TYPE_INCENTIVIZATION) {
				emitProposalCreationFailedEvent(methodContext, 0, this.events);
				throw new Error('Incentivized pool does not exist');
			}
		}

		this._feeMethod.payFee(methodContext, FEE_PROPOSAL_CREATION);
		const index = indexStoreData.newestIndex + 1;
		const currentHeight = ctx.header.height;
		const indexBuffer = Buffer.alloc(4);
		indexBuffer.writeUInt32BE(indexStoreData.newestIndex + 1, 0);

		const Proposal = {
			creationHeight: currentHeight,
			votesYes: BigInt(0),
			votesNo: BigInt(0),
			votesPass: BigInt(0),
			type: ctx.params.type,
			content: ctx.params.content,
			status: PROPOSAL_STATUS_ACTIVE,
		};
		const proposalsStore = this.stores.get(ProposalsStore);
		await proposalsStore.set(methodContext, indexBuffer, Proposal);
		indexStoreData.newestIndex = index;
		await indexStore.set(methodContext, Buffer.from('0'), indexStoreData);
		this.events.get(ProposalCreatedEvent).add(
			methodContext,
			{
				creator: senderAddress,
				index,
				type: ctx.params.type,
			},
			[q96ToBytes(numberToQ96(BigInt(index)))],
			true,
		);
	}
}
