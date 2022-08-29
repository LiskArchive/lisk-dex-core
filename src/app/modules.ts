/* eslint-disable @typescript-eslint/no-empty-function */
import { Application } from 'lisk-sdk';
import { DexModule } from './modules/dex/module';

export const registerModules = (app: Application): void => {
    app.registerModule(new DexModule());
};
