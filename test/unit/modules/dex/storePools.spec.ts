import { BaseStore } from 'lisk-sdk';
import { PoolsStore } from '../../../../src/app/modules/dex/stores';

describe('dex:store:pools', () => {
	it('should have the pools store defined', async () => {
		expect(PoolsStore.prototype).toBeInstanceOf(BaseStore);
	});
});
