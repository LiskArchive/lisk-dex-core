
import { Application, PartialApplicationConfig, TokenModule, ValidatorsModule } from 'lisk-sdk';

import { DexModule } from './modules';

export const getApplication = (config: PartialApplicationConfig): Application => {
	const { app } = Application.defaultApplication(config);
	const dexModule = new DexModule();
	const tokenModule = new TokenModule();
	const validatorModule = new ValidatorsModule();

	dexModule.addDependencies(tokenModule.api, validatorModule.api);
	app.registerModule(dexModule);

	return app;
};