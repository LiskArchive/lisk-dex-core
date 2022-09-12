import { genesisDEXSchema } from '../../../../src/app/modules/dex/schemas'

describe('dex:schema:genesis', () => {
	it('should have the pool schema defined', async () => {
		expect(genesisDEXSchema?.$id).toBe('/dex/genesis');
	});
});