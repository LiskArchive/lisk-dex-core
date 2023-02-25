/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
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

import {
	BaseCommand,
	CommandExecuteContext,
	CommandVerifyContext,
	VerificationResult,
	VerifyStatus,
	TokenMethod,
	FeeMethod,
	codec,
	PoSModule
} from 'lisk-sdk';


import { FEE_PROPOSAL_CREATION, LENGTH_ADDRESS, MAX_NUM_RECORDED_VOTES, MINIMAL_BALANCE_PROPOSE, PROPOSAL_STATUS_ACTIVE, PROPOSAL_TYPE_INCENTIVIZATION, PROPOSAL_TYPE_UNIVERSAL, VOTE_DURATION } from '../constants';


import { createProposalParamsSchema, proposalSchema } from '../schemas';
import { IndexStore, ProposalsStore } from '../stores';
import { CreateProposalParamsData } from '../types';
import {
	emitProposalCreationFailedEvent,
	hasEnded,
} from '../utils/auxiliaryFunctions';

import { sha256, TOKEN_ID_DEX_NATIVE } from '../../dexRewards/constants';
import { COMMAND_ID_CREATE_PORPOSAL, NUM_BYTES_POOL_ID } from '../../dex/constants';
import { DexModule } from '../../dex/module';
import { DexEndpoint } from '../../dex/endpoint';

import { addQ96, numberToQ96, q96ToBytes } from '../../dex/utils/q96';
import { PoSEndpoint } from 'lisk-framework/dist-node/modules/pos/endpoint';
import { PrefixedStateReadWriter } from 'lisk-framework/dist-node/state_machine/prefixed_state_read_writer';
import { createTransientModuleEndpointContext, InMemoryPrefixedStateDB } from 'lisk-framework/dist-node/testing';

export class CreatePorposalCommand extends BaseCommand {
	public id = COMMAND_ID_CREATE_PORPOSAL;
	public schema = createProposalParamsSchema;
	private _tokenMethod!: TokenMethod;
	

	public init({ tokenMethod }): void {
		this._tokenMethod = tokenMethod;
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	public async verify(
		ctx: CommandVerifyContext<CreateProposalParamsData>,
	): Promise<VerificationResult> {
		const pos = new PoSModule();
		let posEndpoint: PoSEndpoint;
		posEndpoint = new PoSEndpoint(pos.stores, pos.offchainStores);
		const stateStore = new PrefixedStateReadWriter(new InMemoryPrefixedStateDB());

		const moduleEndpointContext = createTransientModuleEndpointContext({
			stateStore,
			params: { address: true },
		});

		const methodContext = ctx.getMethodContext();
		const senderAddress = sha256(ctx.transaction.senderPublicKey.toString()).slice(0,LENGTH_ADDRESS);
    	const availableBalance = await this._tokenMethod.getAvailableBalance(methodContext, senderAddress, TOKEN_ID_DEX_NATIVE);
    	const lockedBalance = (await posEndpoint.getLockedStakedAmount(moduleEndpointContext)).amount;
		
		if (addQ96(availableBalance,BigInt(lockedBalance))  < MINIMAL_BALANCE_PROPOSE){
			return {
				status: VerifyStatus.FAIL,
				error: new Error ("Insufficient DEX native token balance to create proposal")
			};
		}
		if(availableBalance < FEE_PROPOSAL_CREATION){
			return {
				status: VerifyStatus.FAIL,
				error: new Error ("Insufficient balance to pay proposal creation fee")
			};
		}
		const type = ctx.params.type;
		const content = ctx.params.content
		if (type === PROPOSAL_TYPE_INCENTIVIZATION){
			if (content.poolID.length != NUM_BYTES_POOL_ID){
				return {
					status: VerifyStatus.FAIL,
					error: new Error ("Pool ID must be provided for an incentivization proposal"),
				};	
			}
		}else if (type === PROPOSAL_TYPE_UNIVERSAL){
			if (content.text.length === 0){
				return {
					status: VerifyStatus.FAIL,
					error: new Error("Proposal text can not be empty for universal proposal")
				};	
			}
			if (content.poolID.length !== 0 || content.multiplier !== 0){
				return {
					status: VerifyStatus.FAIL,
					error: new Error("For universal proposals, pool ID must be empty and multiplier must be set to 0")
				};	
			}
		}else{
			return {
				status: VerifyStatus.FAIL,
				error: new Error ("Invalid Porposal Type")
			};	
		}
		return {
			status: VerifyStatus.OK,
		};
	}

	public async execute(ctx: CommandExecuteContext<CreateProposalParamsData>): Promise<void> {
		const senderAddress = sha256(ctx.transaction.senderPublicKey.toString()).slice(0,LENGTH_ADDRESS);
		const dexModule = new DexModule();
		const feeMethod = new FeeMethod(this.stores, this.events);
		const endpoint = new DexEndpoint(this.stores, dexModule.offchainStores);
		const methodContext = ctx.getMethodContext();

		const indexStore =  this.stores.get(IndexStore);
		let newestIndexTemp = (await indexStore.get(methodContext, Buffer.from("0"))).newestIndex;
		

		if (!hasEnded(methodContext, this.stores.get(ProposalsStore), newestIndexTemp - MAX_NUM_RECORDED_VOTES + 1, ctx.header.height, VOTE_DURATION)){
			emitProposalCreationFailedEvent(methodContext, 0, this.events)
			throw new Error("Limit of proposals with recoded votes is reached")
		}

		if(!(await endpoint.getPool(methodContext, ctx.params.content.poolID))){
			if (ctx.params.type === PROPOSAL_TYPE_INCENTIVIZATION){
				emitProposalCreationFailedEvent(methodContext, 0, this.events)
				throw new Error("Limit of proposals with recoded votes is reached")
			}
		}

		feeMethod.payFee(methodContext, FEE_PROPOSAL_CREATION);
		const index = newestIndexTemp + 1;
    	const currentHeight =ctx.header.height;
    	this.stores.get(ProposalsStore)[index] = codec.encode(proposalSchema, {
        "creationHeight": currentHeight,
        "votesYes": 0,
        "votesNo": 0,
        "votesPass": 0,
        "type": ctx.params.type,
        "content": ctx.params.content,
        "status": PROPOSAL_STATUS_ACTIVE
    	})

		newestIndexTemp = index
    
		this.events.get(ProposalCreatedEvent).add(
			methodContext,
			{
				"creator": senderAddress,
				"index": index,
				"type": ctx.params.type
			},
			[q96ToBytes(numberToQ96(BigInt(index)))],
			true,
		);

		this.events.get(ProposalCreationFailedEvent).add(
			methodContext,
			{
				"reason": 1,
				"index": index,
				"type": ctx.params.type
			},
			[],
		);
       
	}
}
