import { Application, PartialApplicationConfig } from 'lisk-sdk';

import { DexModule, DexIncentivesModule, DexGovernanceModule } from './modules';

export const getApplication = (config: PartialApplicationConfig): Application => {
	const { app, method } = Application.defaultApplication(config);
	const dexModule = new DexModule();
	const dexIncentivesModule = new DexIncentivesModule();
	const dexGovernanceModule = new DexGovernanceModule();

	dexModule.addDependencies(method.token, method.validator, method.fee);
	dexIncentivesModule.addDependencies(
		method.token,
		method.validator,
		method.random,
		method.fee,
		method.pos,
	);
	dexGovernanceModule.addDependencies(method.token, method.pos, method.fee);

	app.registerModule(dexModule);
	app.registerModule(dexIncentivesModule);
	app.registerModule(dexGovernanceModule);

	return app;
};
