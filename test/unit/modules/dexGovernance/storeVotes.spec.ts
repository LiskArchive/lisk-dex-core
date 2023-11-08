import { BaseStore } from 'lisk-sdk';
import { VotesStore } from '../../../../src/app/modules/dexGovernance/stores';

describe('dexGovernance:store:index', () => {
	it('should have the index store defined', () => {
		expect(VotesStore.prototype).toBeInstanceOf(BaseStore);
	});
});
