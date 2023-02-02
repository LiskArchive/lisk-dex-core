/*
 * Copyright © 2021 Lisk Foundation
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
	MAX_LENGTH_PROPOSAL_TEXT,
	LENGTH_POOL_ID,
	MAX_LENGTH_METADATA_TITLE,
	MAX_LENGTH_METADATA_AUTHOR,
	MAX_LENGTH_METADATA_SUMMARY,
	MAX_LENGTH_METADATA_LINK,
	MAX_NUMBER_LIVE_PROPOSALS,
	// LENGTH_ADDRESS,
} from './constants';

export const proposalContentSchema = {
	type: 'object',
	required: ['text', 'poolID', 'multiplier', 'metadata'],
	properties: {
		text: {
			dataType: 'bytes',
			maxLength: MAX_LENGTH_PROPOSAL_TEXT,
			fieldNumber: 1,
		},
		poolID: {
			dataType: 'bytes',
			maxLength: LENGTH_POOL_ID,
			fieldNumber: 2,
		},
		multiplier: {
			dataType: 'uint32',
			fieldNumber: 3,
		},
		metadata: {
			type: 'object',
			required: ['title', 'author', 'summary', 'discussionsTo'],
			fieldNumber: 4,
			properties: {
				title: {
					dataType: 'bytes',
					minLength: 1,
					maxLength: MAX_LENGTH_METADATA_TITLE,
					fieldNumber: 1,
				},
				author: {
					dataType: 'bytes',
					minLength: 1,
					maxLength: MAX_LENGTH_METADATA_AUTHOR,
					fieldNumber: 2,
				},
				summary: {
					dataType: 'bytes',
					minLength: 1,
					maxLength: MAX_LENGTH_METADATA_SUMMARY,
					fieldNumber: 3,
				},
				discussionsTo: {
					dataType: 'bytes',
					maxLength: MAX_LENGTH_METADATA_LINK,
					fieldNumber: 4,
				},
			},
		},
	},
};
export const proposalSchema = {
	$id: '/dexGovernance/proposal',
	type: 'object',
	required: ['creationHeight', 'votesYes', 'votesNo', 'votesPass', 'type', 'content', 'status'],
	properties: {
		creationHeight: {
			dataType: 'uint32',
			fieldNumber: 1,
		},
		votesYes: {
			dataType: 'uint64',
			fieldNumber: 2,
		},
		votesNo: {
			dataType: 'uint64',
			fieldNumber: 3,
		},
		votesPass: {
			dataType: 'uint64',
			fieldNumber: 4,
		},
		type: {
			dataType: 'uint32',
			fieldNumber: 5,
		},
		content: {
			fieldNumber: 6,
			...proposalContentSchema,
		},
		status: {
			dataType: 'uint32',
			fieldNumber: 7,
		},
	},
};

export const votesSchema = {
	$id: '/dexGovernance/votes',
	type: 'object',
	required: ['voteInfos'],
	properties: {
		voteInfos: {
			fieldNumber: 1,
			type: 'array',
			maxLength: MAX_NUMBER_LIVE_PROPOSALS,
			items: {
				type: 'object',
				required: ['proposalIndex', 'decision', 'amount'],
				properties: {
					proposalIndex: {
						dataType: 'uint32',
						fieldNumber: 1,
					},
					decision: {
						dataType: 'uint32',
						fieldNumber: 2,
					},
					amount: {
						dataType: 'uint64',
						fieldNumber: 3,
					},
				},
			},
		},
	},
};

export const genesisDEXGovernanceSchema = {
	$id: '/dexGovernance/genesisDEXGovernance',
	type: 'object',
	required: ['proposalsStore', 'votesStore'],
	properties: {
		proposalsStore: {
			type: 'array',
			fieldNumber: 1,
			items: {
				...proposalSchema,
			},
		},
		votesStore: {
			type: 'array',
			fieldNumber: 2,
			items: {
				type: 'object',
				required: ['address', 'votes'],
				properties: {
					address: {
						dataType: 'bytes',
						// length: LENGTH_ADDRESS,
						fieldNumber: 1,
					},
					votes: {
						fieldNumber: 2,
						...votesSchema,
					},
				},
			},
		},
	},
};
