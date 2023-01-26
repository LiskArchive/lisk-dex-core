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
import { computeCurrentPrice, constructPoolsGraph, getAdjacent, raiseSwapException, swapWithin } from "../../../../src/app/modules/dex/utils/swapFunctions";
import { InMemoryPrefixedStateDB } from "./inMemoryPrefixedState";
import { Address, PoolID, TokenID } from "../../../../src/app/modules/dex/types";
import { createTransientModuleEndpointContext } from "../../../context/createContext";
import { PrefixedStateReadWriter } from '../../../stateMachine/prefixedStateReadWriter';
import { numberToQ96, q96ToBytes } from "../../../../src/app/modules/dex/utils/q96";
import { tickToPrice } from "../../../../src/app/modules/dex/utils/math";
import { PoolsStore } from "../../../../src/app/modules/dex/stores";
import { PoolsStoreData } from "../../../../src/app/modules/dex/stores/poolsStore";


describe('dex:auxiliaryFunctions', () => {
    const poolId: PoolID = Buffer.from('0000000000000000000001000000000000c8', 'hex');
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

    let poolsStore: PoolsStore;

    const methodContext: MethodContext = createMethodContext({
		contextStore: new Map(),
		stateStore,
		eventQueue: new EventQueue(0),
	});

	const moduleEndpointContext = createTransientModuleEndpointContext({
		stateStore,
		params: { address: INVALID_ADDRESS },
	});

    const poolsStoreData: PoolsStoreData = {
		liquidity: BigInt(5),
		sqrtPrice: q96ToBytes(BigInt(tickToPrice(5))),
		incentivesPerLiquidityAccumulator: q96ToBytes(numberToQ96(BigInt(0))),
		heightIncentivesUpdate: 5,
		feeGrowthGlobal0: q96ToBytes(numberToQ96(BigInt(0))),
		feeGrowthGlobal1: q96ToBytes(numberToQ96(BigInt(0))),
		tickSpacing: 1,
	};



    describe('constructor', () => {

        beforeEach(async () => {
            poolsStore = dexModule.stores.get(PoolsStore);
            await poolsStore.setKey(
				methodContext,
				[poolId],
				poolsStoreData,
			);
        })
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
              
        it('computeCurrentPrice', async () => {
            const swapRoute = [poolId]
			const currentPrice = await computeCurrentPrice(moduleEndpointContext, dexModule.stores, token0Id, token1Id, swapRoute);
            expect(currentPrice).not.toBeNull();
		});
		it('constructPoolsGraph', async () => {
            const poolsGraph = await constructPoolsGraph(moduleEndpointContext, dexModule.stores);
			const vertices:Buffer[] = [];
			const edges:Buffer[] = [];

			poolsGraph.vertices.forEach(e => {vertices.push(e)})
			poolsGraph.edges.forEach(e => {edges.push(e)})
			
			expect(vertices.filter(vertex => vertex.equals(token0Id))).toHaveLength(1)
			expect(vertices.filter(vertex => vertex.equals(token1Id))).toHaveLength(1)
			expect(edges.filter(edge => edge.equals(poolId))).toHaveLength(1)
		});  

		
    })
})