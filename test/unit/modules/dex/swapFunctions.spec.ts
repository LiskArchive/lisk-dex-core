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


import { swapWithin } from "../../../../src/app/modules/dex/swapFunctions";

describe('dex:auxiliaryFunctions', () => {

    const sqrtCurrentPrice = BigInt(5);
	const sqrtTargetPrice =  BigInt(10);
	const liquidity = BigInt(100);
	const amountRemaining =  BigInt(90);
	const exactInput = true;

   

    describe('constructor', () => {
        beforeEach(async () => {

		});
        it('swapWithin', () => {
			const [sqrtUpdatedPrice, amountIn, amountOut] = swapWithin(sqrtCurrentPrice,sqrtTargetPrice,liquidity,amountRemaining,exactInput)
            expect(sqrtUpdatedPrice).toBe(BigInt(10))
            expect(amountIn).toBe(BigInt(1))
            expect(amountOut).toBe(BigInt(792281625142643375935439503360))
		});
    })
})