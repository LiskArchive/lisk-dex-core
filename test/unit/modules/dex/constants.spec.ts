import {
	MIN_SQRT_RATIO,
	MAX_SQRT_RATIO,
	STORE_PREFIX_POOLS,
} from '../../../../src/app/modules/dex/constants';

describe('dex:constants', () => {
	it('should have the constants defined', async () => {
		expect(MIN_SQRT_RATIO).toBe(BigInt(4295128735));
		expect(MAX_SQRT_RATIO).toBe(BigInt('1461446704550679960896629428549052887957817041882'));
		expect(STORE_PREFIX_POOLS).toStrictEqual(Buffer.from('0000', 'hex'));
	});
});
