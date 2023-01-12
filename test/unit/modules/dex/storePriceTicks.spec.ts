import { BaseStore } from 'lisk-sdk';
import { PriceTicksStore } from '../../../../src/app/modules/dex/stores';

describe('dex:store:priceTicks', () => {
	it('should have the price ticks store defined', async () => {
		expect(PriceTicksStore.prototype).toBeInstanceOf(BaseStore);
	});
});
