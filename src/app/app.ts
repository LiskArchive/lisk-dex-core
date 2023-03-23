import {
	Application,
	PartialApplicationConfig,
	AuthModule,
	ValidatorsModule,
	TokenModule,
	FeeModule,
	PoSModule,
	RandomModule,
	SidechainInteroperabilityModule,
} from 'lisk-sdk';

import { DynamicRewardModule } from 'lisk-framework/dist-node/modules/dynamic_rewards';

import { DexModule, DexIncentivesModule, DexGovernanceModule } from './modules';

export const getApplication = (config: PartialApplicationConfig): Application => {
	const { app } = Application.defaultApplication(config);
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
	interoperabilityModule.addDependencies(validatorModule.method, tokenModule.method);
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
	dexGovernanceModule.addDependencies(tokenModule.method, posModule.method);
	app.registerModule(authModule);
	app.registerModule(validatorModule);
	app.registerModule(tokenModule);
	app.registerModule(feeModule);
	app.registerModule(interoperabilityModule);
	app.registerModule(posModule);
	app.registerModule(randomModule);
	app.registerModule(dynamicRewardModule);
	app.registerModule(dexIncentivesModule);
	app.registerModule(dexGovernanceModule);
	app.registerModule(dexModule);

	return app;
};
