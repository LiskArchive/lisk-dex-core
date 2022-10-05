import {
	getToken0Id,
	getToken1Id,
	getFeeTier
} from '../../../../src/app/modules/dex/utils/auxiliaryFunctions';

import {
	PoolID, TokenID
} from '../../../../src/app/modules/dex/types';
import { hexToBytes } from '../../../../src/app/modules/dex/constants';

describe('dex:auxiliaryFunctions', () => {
	describe('constructor', () => {
		const poolId: PoolID = Buffer.from(hexToBytes('0x00000000000000000000000100000000000000c8'));
		const token0Id: TokenID = Buffer.from(hexToBytes('0x0000000000000000'));
		const token1Id: TokenID = Buffer.from(hexToBytes('0x0000000100000000'));
		it('getToken0Id', async () => {
			expect(getToken0Id(poolId)).toEqual(token0Id);
		});
		it('getToken1Id', async () => {
			expect(getToken1Id(poolId)).toEqual(token1Id);
		});
		it('getFeeTier', async () => {
			expect(getFeeTier(poolId)).toEqual(Number('0x000000c8'));
		});
	});
});