import {
	Application,
	PartialApplicationConfig,
	PoSModule,
	RandomModule,
	TokenModule,
	ValidatorsModule,
} from 'lisk-sdk';

import { DexModule, DexRewardsModule, DexGovernanceModule } from './modules';

export const getApplication = (config: PartialApplicationConfig): Application => {
	const { app } = Application.defaultApplication(config);
	const dexModule = new DexModule();
	const dexRewardsModule = new DexRewardsModule();
	const dexGovernanceModule = new DexGovernanceModule();
	const tokenModule = new TokenModule();
	const validatorModule = new ValidatorsModule();
	const randomModule = new RandomModule();
	const posModule = new PoSModule();

	dexModule.addDependencies(tokenModule.method, validatorModule.method);
	dexRewardsModule.addDependencies(tokenModule.method, validatorModule.method, randomModule.method);
	app.registerModule(dexModule);
	dexGovernanceModule.addDependencies(tokenModule.method, posModule.method);
	app.registerModule(dexGovernanceModule);

	return app;
};
