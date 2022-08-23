import { positionsSchema } from '../../../../src/app/modules/dex/schemas'

describe('dex:schema:positions', () => {
	it('should have the position schema defined', async () => {
		expect(positionsSchema?.$id).toBe('/dex/positions');
	});
});