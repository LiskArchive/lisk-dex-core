import {
	MIN_SQRT_RATIO,
	MAX_SQRT_RATIO,
	STORE_PREFIX_POOLS,
} from '../../../../src/app/modules/dex/constants';

describe('dex:constants', () => {
<<<<<<< HEAD
	it('should have the constants defined', async () => {
		expect(MIN_SQRT_RATIO).toBe(BigInt(4295128738));
		expect(MAX_SQRT_RATIO).toBe(BigInt('1461446703529909599612049957420313862569572983184'));
		expect(STORE_PREFIX_POOLS).toStrictEqual(Buffer.from('0000', 'hex'));
=======
	it('should have the constants defined', () => {
		expect(MIN_SQRT_RATIO).toBe(BigInt(4295128735));
		expect(MAX_SQRT_RATIO).toBe(BigInt('1461446704550679960896629428549052887957817041882'));
		expect(STORE_PREFIX_POOL).toStrictEqual(Buffer.from('0000', 'hex'));
>>>>>>> development
	});
});
