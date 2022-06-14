import JSBI from 'jsbi';
import {
	add_n,
	div_n,
	muldiv_n,
	mul_n,
	sub_n,
	bytesToQ96,
	q96ToBytes
} from '../../../../src/app/modules/dex/utils/q96';

describe('DexQ96Module', () => {
	describe('constructor', () => {
		const testValue1 = JSBI.BigInt('100');
		const testValue2 = JSBI.BigInt('200');

		it('add', async () => {
			expect(add_n(testValue1, testValue2)).toEqual(JSBI.BigInt('300'));
		});

		it('sub', async () => {
			expect(sub_n(testValue2, testValue1)).toEqual(testValue1);
		});

		it('mul', async () => {
			expect(mul_n(testValue1, JSBI.BigInt('2'))).toEqual(testValue2);
		});

		it('div', async () => {
			expect(div_n(testValue2, JSBI.BigInt('2'))).toEqual(testValue1);
		});

		it('muldiv', async () => {
			expect(muldiv_n(testValue1, JSBI.BigInt('4'), JSBI.BigInt('2'))).toEqual(testValue2);
		});
		
		it('bytesToQ96', async () => {
			expect(q96ToBytes(bytesToQ96(Buffer.from('ffffffff', 'hex')))).toEqual(Buffer.from('ffffffff', 'hex'))
		});
	});
});