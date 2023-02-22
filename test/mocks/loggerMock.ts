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

export const loggerMock = {
	trace: (_data?: Record<string, unknown> | unknown, _message?: string): void => {},
	debug: (_data?: Record<string, unknown> | unknown, _message?: string): void => {},
	info: (_data?: Record<string, unknown> | unknown, _message?: string): void => {},
	warn: (_data?: Record<string, unknown> | unknown, _message?: string): void => {},
	error: (_data?: Record<string, unknown> | unknown, _message?: string): void => {},
	fatal: (_data?: Record<string, unknown> | unknown, _message?: string): void => {},
	level: (): number => 2,
};
