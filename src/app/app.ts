import { Application, PartialApplicationConfig, RandomModule, SidechainInteroperabilityModule, TokenModule, ValidatorsModule } from 'lisk-sdk';

import { DexModule } from './modules';

export const getApplication = (config: PartialApplicationConfig): Application => {
	const { app } = Application.defaultApplication(config);
	const dexModule = new DexModule();
	const tokenModule = new TokenModule();
	const validatorModule = new ValidatorsModule();

	const interoperabilityModule = new SidechainInteroperabilityModule();
	tokenModule.addDependencies(interoperabilityModule.method);
	dexModule.addDependencies(tokenModule.method, validatorModule.method);
	
	app.registerModule(dexModule);

	return app;
};


