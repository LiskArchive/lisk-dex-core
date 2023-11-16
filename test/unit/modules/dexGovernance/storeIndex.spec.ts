import { BaseStore } from 'lisk-sdk';
import { IndexStore } from '../../../../src/app/modules/dexGovernance/stores';

describe('dexGovernance:store:index', () => {
	it('should have the index store defined', () => {
		expect(IndexStore.prototype).toBeInstanceOf(BaseStore);
	});
});
