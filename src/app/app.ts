import {
	Application,
	PartialApplicationConfig,
	AuthModule,
	ValidatorsModule,
	TokenModule,
	FeeModule,
	PoSModule,
	RandomModule,
	RewardModule,
} from 'lisk-sdk';

import { DexModule, DexIncentivesModule, DexGovernanceModule } from './modules';

export const getApplication = (config: PartialApplicationConfig): Application => {
	const { app } = Application.defaultApplication(config);
	const dexModule = new DexModule();
	const authModule = new AuthModule();
	const validatorModule = new ValidatorsModule();
	const tokenModule = new TokenModule();
	const feeModule = new FeeModule();
	const posModule = new PoSModule();
	const randomModule = new RandomModule();
	const rewardModule = new RewardModule();
	const dexIncentivesModule = new DexIncentivesModule();
	const dexGovernanceModule = new DexGovernanceModule();
	
	dexModule.addDependencies(
		authModule.method,
		validatorModule.method,
		tokenModule.method,
		feeModule.method,
		posModule.method,
		randomModule.method,
		rewardModule.method,
		dexIncentivesModule.method,
		dexGovernanceModule.method,
	);
	dexIncentivesModule.addDependencies(
		tokenModule.method,
		validatorModule.method,
		randomModule.method,
		feeModule.method,
		posModule.method,
	);
	dexGovernanceModule.addDependencies(
		tokenModule.method,
		posModule.method,
	)
	app.registerModule(dexModule);

	return app;
};
