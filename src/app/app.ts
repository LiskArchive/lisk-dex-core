import {
	Application,
	PartialApplicationConfig,
	RandomModule,
	TokenModule,
	ValidatorsModule,
} from 'lisk-sdk';

import { DexModule, DexRewardsModule } from './modules';

export const getApplication = (config: PartialApplicationConfig): Application => {
	const { app } = Application.defaultApplication(config);
	const dexModule = new DexModule();
	const dexRewardsModule = new DexRewardsModule();
	const tokenModule = new TokenModule();
	const validatorModule = new ValidatorsModule();
	const randomModule = new RandomModule();

	dexModule.addDependencies(tokenModule.method, validatorModule.method);
	dexRewardsModule.addDependencies(tokenModule.method, validatorModule.method, randomModule.method);
	app.registerModule(dexModule);

	return app;
};


