/* eslint-disable import/no-cycle */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
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

import { createMethodContext, EventQueue } from "lisk-framework/dist-node/state_machine";
import { MethodContext } from "lisk-framework/dist-node/state_machine/method_context";
import { DexModule } from "../../../../src/app/modules";
import { getAdjacent, raiseSwapException, swapWithin } from "../../../../src/app/modules/dex/utils/swapFunctions";
import { InMemoryPrefixedStateDB } from "./inMemoryPrefixedState";
import { Address, TokenID } from "../../../../src/app/modules/dex/types";
import { createTransientModuleEndpointContext } from "../../../context/createContext";
import { PrefixedStateReadWriter } from '../../../stateMachine/prefixedStateReadWriter';


describe('dex:auxiliaryFunctions', () => {
    const token0Id: TokenID = Buffer.from('0000000000000000', 'hex');
    const token1Id: TokenID = Buffer.from('0000010000000000', 'hex');
    const senderAddress: Address = Buffer.from('0000000000000000', 'hex');
    const sqrtCurrentPrice = BigInt(5);
	const sqrtTargetPrice =  BigInt(10);
	const liquidity = BigInt(100);
	const amountRemaining =  BigInt(90);
	const exactInput = true;
    const dexModule = new DexModule();
    const inMemoryPrefixedStateDB = new InMemoryPrefixedStateDB();
    const stateStore: PrefixedStateReadWriter = new PrefixedStateReadWriter(inMemoryPrefixedStateDB);
    const INVALID_ADDRESS = '1234';

    const methodContext: MethodContext = createMethodContext({
		contextStore: new Map(),
		stateStore,
		eventQueue: new EventQueue(0),
	});

	const moduleEndpointContext = createTransientModuleEndpointContext({
		stateStore,
		params: { address: INVALID_ADDRESS },
	});


    describe('constructor', () => {
        it('raiseSwapException', () => {
			raiseSwapException(dexModule.events,methodContext,1,token0Id,token1Id,senderAddress)
            const swapFailedEvent = dexModule.events.values().filter(e => e.name === 'swapFailed')
            expect(swapFailedEvent.length).toBe(1)
		});
        it('swapWithin', () => {
			const [sqrtUpdatedPrice, amountIn, amountOut] = swapWithin(sqrtCurrentPrice,sqrtTargetPrice,liquidity,amountRemaining,exactInput)
            expect(sqrtUpdatedPrice).toBe(BigInt(10))
            expect(amountIn).toBe(BigInt(1))
            expect(amountOut).toBe(BigInt(792281625142643375935439503360))
		});
        it('getAdjacent', () => {
			const adjacent = getAdjacent(moduleEndpointContext, dexModule.stores, token0Id)
            expect(adjacent).not.toBeNull();
		});        
    })
})