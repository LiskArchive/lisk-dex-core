import { BaseStore } from 'lisk-sdk';
import { ProposalsStore } from '../../../../src/app/modules/dexGovernance/stores';

describe('dexGovernance:store:index', () => {
	it('should have the index store defined', () => {
		expect(ProposalsStore.prototype).toBeInstanceOf(BaseStore);
	});
});
