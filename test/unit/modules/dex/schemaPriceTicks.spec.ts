import { priceTicksSchema } from '../../../../src/app/modules/dex/schemas'

describe('dex:schema:priceTicks', () => {
	it('should have the price ticks schema defined', async () => {
		expect(priceTicksSchema?.$id).toBe('/dex/priceTicks');
	});
});