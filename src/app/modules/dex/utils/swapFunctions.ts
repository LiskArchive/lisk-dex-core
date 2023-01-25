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

import { MethodContext } from "lisk-sdk";
import { SwapFailedEvent } from "../events/swapFailed";
import { Address, AdjacentEdgesInterface, TokenID } from "../types";
import { NamedRegistry } from 'lisk-framework/dist-node/modules/named_registry';
import { PoolsStore } from "../stores";
import { getToken0Id, getToken1Id } from "./auxiliaryFunctions";

export const raiseSwapException = (
	events: NamedRegistry,
	methodContext: MethodContext,
	reason: number,
	tokenIdIn: TokenID,
	tokenIdOut: TokenID,
	senderAddress: Address,
) => {
	events.get(SwapFailedEvent).add(
		methodContext,
		{
			senderAddress,
			tokenIdIn,
			tokenIdOut,
			reason,
		},
		[senderAddress],
		true,
	);
};

export const getAdjacent = async (
	methodContext: MethodContext,
	stores: NamedRegistry,
	vertex: TokenID,
): Promise<AdjacentEdgesInterface[]> => {
	const result: AdjacentEdgesInterface[] = [];
	
	const poolIDs = await endpoint.getAllPoolIDs(methodContext, stores.get(PoolsStore));
	poolIDs.forEach(edge => {
		if (getToken0Id(edge).equals(vertex)) {
			result.push({ edge, vertex: getToken1Id(edge) });
		} else if (getToken1Id(edge).equals(vertex)) {
			result.push({ edge, vertex: getToken0Id(edge) });
		}
	});
	return result;
};