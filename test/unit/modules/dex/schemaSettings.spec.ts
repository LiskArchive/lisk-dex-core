import { settingsSchema } from '../../../../src/app/modules/dex/schemas'

describe('dex:schema:settings', () => {
	it('should have the pool schema defined', async () => {
		expect(settingsSchema?.$id).toBe('/dex/settings');
	});
});