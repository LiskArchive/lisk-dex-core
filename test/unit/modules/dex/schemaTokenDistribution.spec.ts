import { tokenDistributionSchema } from '../../../../src/app/modules/dex/schemas';

describe('dex:schema:tokendistribution', () => {
	it('should have the pool schema defined', () => {
		expect(tokenDistributionSchema?.$id).toBe('dex/tokenDistribution');
	});
});
