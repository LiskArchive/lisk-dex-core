import {
	getToken0Id,
	getToken1Id,
	getFeeTier,
} from '../../../../src/app/modules/dex/utils/auxiliaryFunctions';

import { PoolID, TokenID } from '../../../../src/app/modules/dex/types';

describe('dex:auxiliaryFunctions', () => {
	describe('constructor', () => {
		const poolId: PoolID = Buffer.from('00000000000000000000000100000000000000c8', 'hex');
		const token0Id: TokenID = Buffer.from('0000000000000000', 'hex');
		const token1Id: TokenID = Buffer.from('0000000100000000', 'hex');
		it('getToken0Id', async () => {
			expect(getToken0Id(poolId)).toEqual(token0Id);
		});
		it('getToken1Id', async () => {
			expect(getToken1Id(poolId)).toEqual(token1Id);
		});
		it('getFeeTier', async () => {
			expect(getFeeTier(poolId)).toEqual(Buffer.from('000000c8', 'hex').readUInt32BE(0));
		});
	});
});
