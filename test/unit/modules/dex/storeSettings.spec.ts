import { BaseStore } from 'lisk-sdk';
import { SettingsStore } from '../../../../src/app/modules/dex/stores';

describe('dex:store:settings', () => {
	it('should have the settings store defined', () => {
		expect(SettingsStore.prototype).toBeInstanceOf(BaseStore);
	});
});
