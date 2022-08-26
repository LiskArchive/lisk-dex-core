import { poolsSchema } from '../../../../src/app/modules/dex/schemas'

describe('dex:schema:pools', () => {
	it('should have the pool schema defined', async () => {
		expect(poolsSchema?.$id).toBe('/dex/pools');
	});
});