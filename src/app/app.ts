import {
	Application,
	PartialApplicationConfig,
	RandomModule,
	TokenModule,
	ValidatorsModule,
	FeeModule,
	PoSModule,
} from 'lisk-sdk';

import { DexModule, DexIncentivesModule } from './modules';

export const getApplication = (config: PartialApplicationConfig): Application => {
	const { app } = Application.defaultApplication(config);
	const dexModule = new DexModule();
	const dexIncentivesModule = new DexIncentivesModule();
	const tokenModule = new TokenModule();
	const validatorModule = new ValidatorsModule();
	const randomModule = new RandomModule();
	const feeModule = new FeeModule();
	const posModule = new PoSModule();

	dexModule.addDependencies(tokenModule.method, validatorModule.method, feeModule.method);
	dexIncentivesModule.addDependencies(
		tokenModule.method,
		validatorModule.method,
		randomModule.method,
		feeModule.method,
		posModule.method,
	);
	app.registerModule(dexModule);

	return app;
};
