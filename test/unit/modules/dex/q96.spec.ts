import {/*
	qn_r,
	roundDown_n,
	roundUp_n,*/
	add_n,/*
	sub_n,
	mul_n,
	div_n,
	muldiv_n,
	muldiv_n_RoundUp,
	Q_n_ToInt,
	Q_n_ToIntRoundUp,
	inv_n,
	bytesToQ96,
	q96ToBytes*/
} from '../../../../src/app/modules/dex/utils/q96';
import JSBI from 'jsbi';

describe('DexQ96Module', () => {
	describe('constructor', () => {
		const test = JSBI.BigInt('100');
		console.log("RESULT", add_n(test,test))
		it('add', async () => {
			expect(add_n(test,test)).toEqual('7fffffff');
		});
		it('sub', async () => {

		});
		it('mul', async () => {
			
		});
		it('div', async () => {
			
		});
		it('muldiv', async () => {
			
		});
		it('bytesToQ96', async () => {
			
		});
	});
}); 