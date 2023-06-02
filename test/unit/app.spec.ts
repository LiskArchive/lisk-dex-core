import {
	AuthModule,
	FeeModule,
	PoSModule,
	RandomModule,
	SidechainInteroperabilityModule,
	TokenModule,
	ValidatorsModule,
} from 'lisk-framework';
import { inspect } from 'util';
import { DynamicRewardModule } from 'lisk-framework/dist-node/modules/dynamic_rewards';
import { getApplication } from '../../src/app/app';
import { DexGovernanceModule, DexIncentivesModule, DexModule } from '../../src/app/modules';

describe('app', () => {
	it('modules should be registered in a correct order', () => {
		const dexModule = new DexModule();
		const authModule = new AuthModule();
		const validatorModule = new ValidatorsModule();
		const tokenModule = new TokenModule();
		const feeModule = new FeeModule();
		const interoperabilityModule = new SidechainInteroperabilityModule();
		const posModule = new PoSModule();
		const randomModule = new RandomModule();
		const dynamicRewardModule = new DynamicRewardModule();
		const dexIncentivesModule = new DexIncentivesModule();
		const dexGovernanceModule = new DexGovernanceModule();

		// resolve dependencies
		interoperabilityModule.addDependencies(validatorModule.method, tokenModule.method);
		feeModule.addDependencies(tokenModule.method, interoperabilityModule.method);
		dynamicRewardModule.addDependencies(
			tokenModule.method,
			randomModule.method,
			validatorModule.method,
			posModule.method,
		);
		posModule.addDependencies(
			randomModule.method,
			validatorModule.method,
			tokenModule.method,
			feeModule.method,
		);
		tokenModule.addDependencies(interoperabilityModule.method, feeModule.method);

		// resolve interoperability dependencies
		interoperabilityModule.registerInteroperableModule(tokenModule);
		interoperabilityModule.registerInteroperableModule(feeModule);

		dexModule.addDependencies(tokenModule.method, validatorModule.method, feeModule.method);
		dexIncentivesModule.addDependencies(
			tokenModule.method,
			validatorModule.method,
			randomModule.method,
			feeModule.method,
			posModule.method,
		);
		dexGovernanceModule.addDependencies(tokenModule.method, posModule.method, feeModule.method);

		const expectedRegisteredModules = [
			authModule,
			validatorModule,
			tokenModule,
			feeModule,
			interoperabilityModule,
			posModule,
			randomModule,
			dynamicRewardModule,
			dexModule,
			dexIncentivesModule,
			dexGovernanceModule,
		];

		const application = getApplication({ genesis: { chainID: '30000000' } });
		const registeredModules = application.getRegisteredModules();
		expect(inspect(registeredModules)).toEqual(inspect(expectedRegisteredModules));
	});
});
