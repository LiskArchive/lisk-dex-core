/*
 * Copyright © 2020 Lisk Foundation
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

<<<<<<< HEAD
<<<<<<< HEAD
=======
// Convert a hex string to a byte array
export const hexToBytes = hex => {
	const bytes: number[] = [];
	for (let c = 0; c < hex.length; c += 2)
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		bytes.push(parseInt(hex.substr(c, 2), 16));
	return bytes;
};
=======
import { numberToQ96 } from './utils/q96';
import { Q96 } from './types';
>>>>>>> 82e1f2e (Fix auxiliary and math functions, improve code)

export const NUM_BYTES_ADDRESS = 20; // The number of bytes of an address (uint32)
>>>>>>> b3502bb (Remove dependencies, fix formatting)
export const MAX_NUM_BYTES_Q96 = 24; // The number of bytes of a fractional number stored in Q96 format (uint32)
export const MAX_UINT_32 = 4294967295;
export const MAX_UINT_64 = BigInt('18446744073709551615');

export const NUM_BYTES_ADDRESS = 20; // The number of bytes of an address (uint32)
export const NUM_BYTES_Q96 = 24; // The number of bytes of a fractional number stored in Q96 format (uint32)

// DEX Module Constants
export const MODULE_ID_DEX = Buffer.from('0000', 'hex'); // TBA	ID of the DEX module (bytes)
export const MODULE_NAME_DEX = 'dex';
export const NFT_COLLECTION_DEX = Buffer.from('0000', 'hex'); // The collection of the NFTs created for every position. (bytes)
export const NUM_BYTES_POOL_ID = 16; // The number of bytes of a pool ID. (uint32)
export const NUM_BYTES_TICK_ID = 20; // The number of bytes of a price tick ID. (uint32)
export const NUM_BYTES_POSITION_ID = 24; // The number of bytes of a position ID. (uint32)
export const MAX_NUMBER_CROSSED_TICKS = 0; // TBA	Maximum number of price ticks to be crossed by a single swap. (uint32)
export const MAX_HOPS_SWAP = 0; // TBA	Maximum number of different pools that a complete swap can interact with. (uint32)
export const MAX_NUM_POSITIONS_FEE_COLLECTION = 0; // TBD	The maximum number of positions for which it is possible to collect fees in one transaction. (uint32)
<<<<<<< HEAD
export const TOKEN_ID_FEE_DEX = Buffer.from('0x000'); // The ID of the token used for fees. This defines the type of token in which the additional fees for pool creation and position creation are paid. (bytes)
export const POOL_CREATION_FEE = 0; // This amount of tokens is transferred to the protocol fee account when creating a new pool. (uint64) (configurable)
=======
export const TOKEN_ID_FEE_DEX = Buffer.from('0000', 'hex'); // The ID of the token used for fees. This defines the type of token in which the additional fees for pool creation and position creation are paid. (bytes)
export const POOL_CREATION_FEE = BigInt(0); // This amount of tokens is transferred to the protocol fee account when creating a new pool. (uint64) (configurable)
>>>>>>> 82e1f2e (Fix auxiliary and math functions, improve code)
export const POSITION_CREATION_FEE = 0; // This amount of tokens is transferred to the protocol fee account when creating a new position. (uint64) (configurable)

// Token Module Constants
export const CHAIN_ID_ALIAS_NATIVE = Buffer.from('0000', 'hex'); // chainID value of a native token.
export const NUM_BYTES_TOKEN_ID = 8; // The number of bytes of a token ID. (uint32)

// DEX Module Store
<<<<<<< HEAD
<<<<<<< HEAD
export const STORE_PREFIX_POOL = Buffer.from('0x0000') // Store prefix of the pools substore.
export const STORE_PREFIX_PRICE_TICK = Buffer.from('0x8000') // Store prefix of the price ticks substore.
export const STORE_PREFIX_POSITION = Buffer.from('0xc000') // Store prefix of the positions substore.
export const STORE_PREFIX_SETTINGS = Buffer.from('0xe000') // Store prefix of the protocol settings substore.

// DEX Module Command IDs
export const COMMAND_ID_SWAP_EXACT_INPUT = Buffer.from('0x0000') // Command ID of swap exact input command.
export const COMMAND_ID_SWAP_EXACT_OUTPUT = Buffer.from('0x0001') // Command ID of swap exact output command.
export const COMMAND_ID_SWAP_WITH_PRICE_LIMIT = Buffer.from('0x0002') // Command ID of swap with price limit command.
export const COMMAND_ID_CREATE_POOL = Buffer.from('0x0003') // Command ID of create pool command.
export const COMMAND_ID_CREATE_POSITION = Buffer.from('0x0004') // Command ID of create position command.
export const COMMAND_ID_ADD_LIQUIDITY = Buffer.from('0x0005') // Command ID of add liquidity command.
export const COMMAND_ID_REMOVE_LIQUIDITY = Buffer.from('0x0006') // Command ID of remove liquidity command.
export const COMMAND_ID_COLLECT_FEES = Buffer.from('0x0007') // Command ID of collect fees command.

// Math Constants
export const MIN_TICK = -887272 // The minimum possible tick value as a sint32.
export const MAX_TICK = 887272 // The maximum possible tick value as a sint32.
<<<<<<< HEAD
=======
export const LOG_MAX_TICK = Math.log(MAX_TICK);
>>>>>>> 7616e4c (PRICE_VALUE_FOR_TICK_1)
export const MIN_SQRT_RATIO = BigInt(4295128738) // Todo: check with devs	The minimum possible price value in the Q96 representation.
export const MAX_SQRT_RATIO = BigInt('1461446703529909599612049957420313862569572983184') // Todo: check with devs	The maximum possible price value in the Q96 representation.
export const PRICE_VALUE_FOR_BIT_POSITION_IN_Q96 = []; // TBA	Array of uint256 values with the pre-computed values of price for certain values of tickValue in the Q96 representation.

=======
export const STORE_PREFIX_POOL = Buffer.from(hexToBytes('0x0000')); // Store prefix of the pools substore.
export const STORE_PREFIX_PRICE_TICK = Buffer.from(hexToBytes('0x8000')); // Store prefix of the price ticks substore.
export const STORE_PREFIX_POSITION = Buffer.from(hexToBytes('0xc000')); // Store prefix of the positions substore.
export const STORE_PREFIX_SETTINGS = Buffer.from(hexToBytes('0xe000')); // Store prefix of the protocol settings substore.
=======
export const STORE_PREFIX_POOL = Buffer.from('0000', 'hex'); // Store prefix of the pools substore.
export const STORE_PREFIX_PRICE_TICK = Buffer.from('8000', 'hex'); // Store prefix of the price ticks substore.
export const STORE_PREFIX_POSITION = Buffer.from('c000', 'hex'); // Store prefix of the positions substore.
export const STORE_PREFIX_SETTINGS = Buffer.from('e000', 'hex'); // Store prefix of the protocol settings substore.
>>>>>>> 82e1f2e (Fix auxiliary and math functions, improve code)

// DEX Module Command IDs and Names
export const COMMAND_ID_SWAP_EXACT_INPUT = Buffer.from('0000', 'hex'); // Command ID of swap exact input command.
export const COMMAND_ID_SWAP_EXACT_OUTPUT = Buffer.from('0001', 'hex'); // Command ID of swap exact output command.
export const COMMAND_ID_SWAP_WITH_PRICE_LIMIT = Buffer.from('0002', 'hex'); // Command ID of swap with price limit command.
export const COMMAND_ID_CREATE_POOL = Buffer.from('0003', 'hex'); // Command ID of create pool command.
export const COMMAND_NAME_CREATE_POOL = 'createPool'; // Command name of create pool command.
export const COMMAND_ID_CREATE_POSITION = Buffer.from('0004', 'hex'); // Command ID of create position command.
export const COMMAND_ID_ADD_LIQUIDITY = Buffer.from('0005', 'hex'); // Command ID of add liquidity command.
export const COMMAND_ID_REMOVE_LIQUIDITY = Buffer.from('0006', 'hex'); // Command ID of remove liquidity command.
export const COMMAND_ID_COLLECT_FEES = Buffer.from('0007', 'hex'); // Command ID of collect fees command.

// Math Constants
export const MIN_TICK = -887272; // The minimum possible tick value as a sint32.
export const MAX_TICK = 887272; // The maximum possible tick value as a sint32.
export const LOG_MAX_TICK = 19;
export const MIN_SQRT_RATIO = BigInt(4295128738); // Todo: check with devs	The minimum possible price value in the Q96 representation.
export const MAX_SQRT_RATIO = BigInt('1461446703529909599612049957420313862569572983184'); // Todo: check with devs	The maximum possible price value in the Q96 representation.
<<<<<<< HEAD
export const PRICE_VALUE_FOR_BIT_POSITION_IN_Q96 = [BigInt(0)]; // TBA	Array of uint256 values with the pre-computed values of price for certain values of tickValue in the Q96 representation.
=======
export const PRICE_VALUE_FOR_BIT_POSITION_IN_Q96: Q96[] = []; // TBA	Array of uint256 values with the pre-computed values of price for certain values of tickValue in the Q96 representation.
for (let i = 0; i < LOG_MAX_TICK; i += 1) {
	const eachPriceValue = BigInt(Math.floor(1.0001 ** ((-2) ** i / 2)));
	PRICE_VALUE_FOR_BIT_POSITION_IN_Q96.push(numberToQ96(eachPriceValue));
}
>>>>>>> 82e1f2e (Fix auxiliary and math functions, improve code)

export const POOL_CREATION_SUCCESS = 0; // Return code for successful pool creation.           |
export const POOL_CREATION_FAILED_INVALID_FEE_TIER = 1; // Return code for failed pool creation due to an invalid fee tier in the pool creation. |
export const POOL_CREATION_FAILED_ALREADY_EXISTS = 2; // Return code for failed pool creation due to an already existing pool. |
export const POSITION_CREATION_SUCCESS = 0; // Return code for successful position creation.       |
export const POSITION_CREATION_FAILED_NO_POOL = 1; // Return code for failed position creation due to a non-existing pool. |
export const POSITION_CREATION_FAILED_INVALID_TICK_SPACING = 2; // Return code for failed position creation due to a invalid tick spacing. |
export const POSITION_CREATION_FAILED_INVALID_TICKS = 3; // Return code for failed position creation due to a invalid ticks. |
export const POSITION_UPDATE_FAILED_NOT_EXISTS = 1; // Return code for failed position update as position does not exist. |
export const POSITION_UPDATE_FAILED_NOT_OWNER = 2; // Return code for failed position update as position owner is different from transaction sender. |
export const POSITION_UPDATE_FAILED_INSUFFICIENT_LIQUIDITY = 3; // Return code for failed position update as transaction sender is not position owner. |
<<<<<<< HEAD
export const TOKEN_ID_LSK = Buffer.from(hexToBytes('0x00000001000000')); // The token ID of the LSK token.  Added conversion to hex for testing in auxiliaryFunctions         |
export const TOKEN_ID_REWARDS = Buffer.from(hexToBytes('0x00000001000000')); // The token ID of the token used for liquidity provider incentives. For testing added hexToBytes  and using LSK token as an example         |
=======
export const TOKEN_ID_LSK = Buffer.from('0000000100000000', 'hex'); // The token ID of the LSK token.           |
export const TOKEN_ID_REWARDS = Buffer.from(''); // The token ID of the token used for liquidity provider incentives.           |
>>>>>>> 82e1f2e (Fix auxiliary and math functions, improve code)

export const ADDRESS_LIQUIDITY_PROVIDERS_REWARDS_POOL = Buffer.from([]);

>>>>>>> b3502bb (Remove dependencies, fix formatting)
export const defaultConfig = {
	feeTiers: {
		100: 2,
		500: 10,
		3000: 60,
		10000: 200,
	},
};
