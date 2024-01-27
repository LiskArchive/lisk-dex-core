/* eslint-disable import/no-cycle */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/*
 * Copyright © 2022 Lisk Foundation
 *
 * See the LICENSE file at the top-level directory of this distribution
 * for licensing information.
 *
 * Unless otherwise agreed in a custom licensing agreement with the Lisk Foundation,
 * no part of this software, including this file, may be copied, modified,
 * propagated, or distributed except according to the terms contained in the
 * LICENSE file.
 *
 * Removal or modification of this copyright notice is prohibited.
 */

import { chain, cryptography, db, ModuleEndpointContext, testing } from 'lisk-sdk';
import { PrefixedStateReadWriter } from '../stateMachine/prefixedStateReadWriter';
import { loggerMock } from '../mocks/loggerMock';
import { createImmutableMethodContext } from './methodContext';
import { Logger } from '../logger/logger';

const createTestHeader = () =>
	new chain.BlockHeader({
		height: 0,
		generatorAddress: cryptography.utils.getRandomBytes(20),
		previousBlockID: Buffer.alloc(0),
		timestamp: Math.floor(Date.now() / 1000),
		version: 0,
		transactionRoot: cryptography.utils.hash(Buffer.alloc(0)),
		stateRoot: cryptography.utils.hash(Buffer.alloc(0)),
		maxHeightGenerated: 0,
		maxHeightPrevoted: 0,
		impliesMaxPrevotes: true,
		assetRoot: cryptography.utils.hash(Buffer.alloc(0)),
		aggregateCommit: {
			height: 0,
			aggregationBits: Buffer.alloc(0),
			certificateSignature: Buffer.alloc(0),
		},
		validatorsHash: cryptography.utils.hash(Buffer.alloc(0)),
	});

export const createTransientModuleEndpointContext = (params: {
	stateStore?: PrefixedStateReadWriter;
	moduleStore?: chain.StateStore;
	context?: { header: chain.BlockHeaderAttrs };
	params?: Record<string, unknown>;
	logger?: Logger;
	chainID?: Buffer;
}): ModuleEndpointContext => {
	const stateStore =
		params.stateStore ?? new PrefixedStateReadWriter(new testing.InMemoryPrefixedStateDB());
	const moduleStore = params.moduleStore ?? new chain.StateStore(new db.InMemoryDatabase());
	const parameters = params.params ?? {};
	const logger = params.logger ?? loggerMock;
	const chainID = params.chainID ?? Buffer.alloc(0);
	const ctx = {
		getStore: (moduleID: Buffer, storePrefix: Buffer) => stateStore.getStore(moduleID, storePrefix),
		getOffchainStore: (moduleID: Buffer, storePrefix: Buffer) =>
			moduleStore.getStore(moduleID, storePrefix),
		getImmutableMethodContext: () => createImmutableMethodContext(stateStore),
		params: parameters,
		header: params.context?.header ?? createTestHeader(),
		logger,
		chainID,
	};
	return ctx;
};
