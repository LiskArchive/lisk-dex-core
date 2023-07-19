import {
	tickToPrice,
	priceToTick,
	getAmount0Delta,
	getAmount1Delta,
	computeNextPrice
} from '../../../../src/app/modules/dex/utils/math';

describe('dex:math', () => {
	const one = BigInt(1);
	it('tickToPrice', () => {
		expect(() => tickToPrice(-887273)).toThrow();
		expect(tickToPrice(314)).toBe(BigInt("80481797268557086721408463874"));
	});
	it('priceToTick', () => {
		expect(priceToTick(BigInt("248776430294790029895352188928"))).toBe(22885);
	});
	it('getAmount0Delta', () => {
		expect(() => getAmount0Delta(one, one, BigInt(0), false)).toThrow();
		expect(getAmount0Delta(
			BigInt("248776430294790029895352188928"),
			BigInt("316912650057057350374175801344"),
			BigInt("100000"),
			true
		)).toBe(BigInt(6848));
	});
	it('getAmount1Delta', () => {
		expect(() => getAmount1Delta(one, one, BigInt(0), false)).toThrow();
		expect(getAmount1Delta(
			BigInt("248776430294790029895352188928"),
			BigInt("316912650057057350374175801344"),
			BigInt("100000"),
			true
		)).toBe(BigInt(86000));
	});
	it('computeNextPrice', () => {
		expect(computeNextPrice(
			BigInt("248776430294790029895352188928"),
			BigInt("100000"),
			BigInt("5000"),
			true,
			true
		)).toBe(BigInt("215018522294546264959834494005"));
	});
});
