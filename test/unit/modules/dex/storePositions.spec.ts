import { BaseStore } from 'lisk-sdk';
import { PositionsStore } from '../../../../src/app/modules/dex/stores';

describe('dex:store:pools', () => {
	it('should have the positions store defined', async () => {
		expect(PositionsStore.prototype).toBeInstanceOf(BaseStore);
	});
});
