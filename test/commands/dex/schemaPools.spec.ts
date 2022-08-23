import { poolsSchema } from '../../../src/app/modules/dex/schemas'

describe('account:create', () => {
	it('should have the pool schema defined', async () => {
		expect(poolsSchema?.$id).toBe('/dex/pools');
	});
});