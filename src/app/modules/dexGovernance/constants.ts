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

export const TOKEN_ID_DEX = Buffer.from('0000000200000000', 'hex'); // Token ID of the native token of DEX sidechain.
export const VOTE_DURATION = 260000; // Length of the vote period in blocks. This LIP assumes that the constant `LOCKING_PERIOD_STAKES` of [LIP 57][posModule] satisfies: `VOTE_DURATION >= LOCKING_PERIOD_STAKES` so the PoS locked tokens cannot be unlocked and used twice to vote from two different accounts. For the same reason the outcome of a proposal is checked before executing any block transactions (see [`beforeTransactionsExecute` hook](#before-transactions-execution)).
export const QUORUM_DURATION = 130000; // Length of the quorum period in blocks. After this period the quorum is checked.
export const FEE_PROPOSAL_CREATION = BigInt(500000000000); // * 10^8|Amount of fee to be paid for proposal creation in DEX native tokens.
export const MINIMAL_BALANCE_PROPOSE = BigInt(10000000000000); // * 10^8|Minimal amount of DEX native tokens an account should have to create a proposal (including PoS locked tokens).
export const QUORUM_PERCENTAGE = BigInt(10000); // Relative amount of votes required for a proposal to pass the quorum, in parts-per-million of the amount of the total supply.
export const MAX_NUM_RECORDED_VOTES = 100; // Maximal number of proposals allowed to exist simultaneously.
export const MAX_LENGTH_PROPOSAL_TEXT = 10240; // 1024|The maximal allowed length for proposal text, in bytes.
export const MAX_LENGTH_METADATA_TITLE = 124; // The maximal allowed length for data in the `title` property in proposal metadata, in bytes.
export const MAX_LENGTH_METADATA_AUTHOR = 200; // The maximal allowed length for data in the `author` property in proposal metadata, in bytes.
export const MAX_LENGTH_METADATA_SUMMARY = 500; // The maximal allowed length for `summary` property of proposal metadata, in bytes.
export const MAX_LENGTH_METADATA_LINK = 200; // The maximal allowed length for `discussionsTo` property of proposal metadata, in bytes.
export const LENGTH_PROPOSAL_ID = 4; // The number of bytes of a proposal ID.
export const LENGTH_POOL_ID = 20; // The number of bytes of a DEX pool ID.
export const LENGTH_ADDRESS = 20; // The number of bytes of an address.
export const MODULE_NAME_DEX_GOVERNANCE = 'dexGovernance'; // Name of the DEX Governance module.
export const SUBSTORE_PREFIX_PROPOSALS = Buffer.from('0000', 'hex'); // Substore prefix of the proposals substore.
export const SUBSTORE_PREFIX_VOTES = Buffer.from('8000', 'hex'); // Substore prefix of the votes substore.
export const SUBSTORE_PREFIX_INDEX = Buffer.from('c000', 'hex'); // Substore prefix of the index substore.
export const COMMAND_CREATE_PROPOSAL = 'createProposal'; // Command name of the create proposal command.
export const COMMAND_VOTE_ON_PROPOSAL = 'voteOnProposal'; // Command name of the vote command.
export const EVENT_NAME_PROPOSAL_CREATED = 'proposalCreated'; // Event name of the Proposal Created event.
export const EVENT_NAME_PROPOSAL_CREATION_FAILED = 'proposalCreationFailed'; // Event name of the Proposal Creation Failed event.
export const EVENT_NAME_PROPOSAL_QUORUM_CHECKED = 'proposalQuorumChecked'; // Event name of the Proposal Quorum Checked event.
export const EVENT_NAME_PROPOSAL_OUTCOME_CHECKED = 'proposalOutcomeChecked'; // Event name of the Proposal Outcome Checked event.
export const EVENT_NAME_PROPOSAL_VOTED = 'proposalVoted'; // Event name of the Proposal Voted event.
export const CREATION_FAILED_LIMIT_RECORDED_VOTES = 0; // Event error code for failed proposal creation when the limit of live proposals is reached.
export const CREATION_FAILED_NO_POOL = 1; // Event error code for failed incentivization proposal creation when the incentivized pool does not exist.
export const PROPOSAL_TYPE_UNIVERSAL = 0; // Code for universal type proposals.
export const PROPOSAL_TYPE_INCENTIVIZATION = 1; // Code for incentivization type proposals.
export const PROPOSAL_STATUS_ACTIVE = 0; // Status for a currently active proposal.
export const PROPOSAL_STATUS_FINISHED_ACCEPTED = 1; // Status for a finished proposal that was accepted.
export const PROPOSAL_STATUS_FINISHED_FAILED = 2; // Status for a finished proposal that passed the quorum check but failed the vote.
export const PROPOSAL_STATUS_FAILED_QUORUM = 3; // Status for a proposal that has ended because of failed quorum after quorum duration had elapsed.
export const DECISION_YES = 0; // Code for the vote decision "Yes".
export const DECISION_NO = 1; // Code for the vote decision "No".
export const DECISION_PASS = 2; // Code for the vote decision "Pass".

export const defaultConfig = {};
