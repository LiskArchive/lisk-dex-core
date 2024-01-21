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
	MAX_LENGTH_PROPOSAL_TEXT,
	LENGTH_POOL_ID,
	MAX_LENGTH_METADATA_TITLE,
	MAX_LENGTH_METADATA_AUTHOR,
	MAX_LENGTH_METADATA_SUMMARY,
	MAX_LENGTH_METADATA_LINK,
	MAX_NUM_RECORDED_VOTES,
} from './constants';

export const proposalContentSchema = {
	$id: '/dexGovernance/proposalContentSchema',
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
			maxLength: MAX_NUM_RECORDED_VOTES,
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
export const indexStoreSchema = {
	$id: '/dexGovernance/store/index',
	type: 'object',
	required: ['newestIndex', 'nextOutcomeCheckIndex', 'nextQuorumCheckIndex'],
	properties: {
		newestIndex: {
			dataType: 'sint32',
			fieldNumber: 1,
		},
		nextOutcomeCheckIndex: {
			dataType: 'uint32',
			fieldNumber: 2,
		},
		nextQuorumCheckIndex: {
			dataType: 'uint32',
			fieldNumber: 3,
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

export const createProposalParamsSchema = {
	$id: '/dexGovernance/createProposalParams',
	type: 'object',
	required: ['type', 'content'],
	properties: {
		type: {
			dataType: 'uint32',
			fieldNumber: 1,
		},
		content: {
			...proposalContentSchema,
			fieldNumber: 2,
		},
	},
};

export const getProposalRequestSchema = {
	$id: '/dexGovernance/endpoint/getProposal',
	type: 'object',
	properties: {
		proposal: {
			type: 'number',
			format: 'uint32',
		},
	},
	required: ['proposal'],
};

export const getProposalResponseSchema = {
	$id: '/dexGovernance/endpoint/getProposalResponse',
	type: 'object',
	required: ['proposal'],
	properties: {
		type: 'object',
		required: ['creationHeight', 'votesYes', 'votesNo', 'votesPass', 'type', 'content', 'status'],
		properties: {
			creationHeight: {
				type: 'string',
				format: 'uint32',
			},
			votesYes: {
				type: 'string',
				format: 'uint64',
			},
			votesNo: {
				type: 'string',
				format: 'uint64',
			},
			votesPass: {
				type: 'string',
				format: 'uint64',
			},
			type: {
				type: 'string',
				format: 'uint32',
			},
			content: {
				type: 'object',
				required: ['text', 'poolID', 'multiplier', 'metadata'],
				properties: {
					text: {
						type: 'string',
					},
					poolID: {
						type: 'string',
					},
					multiplier: {
						type: 'string',
					},
					metadata: {
						type: 'object',
						required: ['title', 'author', 'summary', 'discussionsTo'],
						fieldNumber: 4,
						properties: {
							title: {
								type: 'string',
							},
							author: {
								type: 'string',
							},
							summary: {
								type: 'string',
							},
							discussionsTo: {
								type: 'string',
							},
						},
					},
				},
			},
			status: {
				type: 'string',
				format: 'uint32',
			},
		},
	},
};

export const getUserVotesRequestSchema = {
	$id: '/dexGovernance/endpoint/getUserVotes',
	type: 'object',
	properties: {
		voterAddress: {
			type: 'string',
		},
	},
	required: ['voterAddress'],
};

export const getUserVotesResponseSchema = {
	$id: '/dexGovernance/endpoint/getUserVotesResponse',
	type: 'object',
	required: ['voteInfos'],
	properties: {
		voteInfos: {
			type: 'array',
			items: {
				type: 'object',
				required: ['proposalIndex', 'decision', 'amount'],
				proposalIndex: {
					type: 'string',
					format: 'uint32',
				},
				decision: {
					type: 'string',
					format: 'uint32',
				},
				amount: {
					type: 'string',
					format: 'uint64',
				},
			},
		},
	},
};

export const getIndexStoreResponseSchema = {
	$id: '/dexGovernance/endpoint/getIndexStoreResponse',
	type: 'object',
	required: ['indexStore'],
	properties: {
		indexStore: {
			type: 'object',
			required: ['newestIndex', 'nextOutcomeCheckIndex', 'nextQuorumCheckIndex'],
			newestIndex: {
				type: 'string',
				format: 'sint32',
			},
			nextOutcomeCheckIndex: {
				type: 'string',
				format: 'uint32',
			},
			nextQuorumCheckIndex: {
				type: 'string',
				format: 'uint32',
			},
		},
	},
};

export const voteOnProposalParamsSchema = {
	$id: '/dexGovernance/voteOnProposalParamsSchema',
	type: 'object',
	required: ['proposalIndex', 'decision'],
	properties: {
		proposalIndex: {
			dataType: 'uint32',
			fieldNumber: 1,
		},
		decision: {
			dataType: 'uint32',
			fieldNumber: 2,
		},
	},
};
