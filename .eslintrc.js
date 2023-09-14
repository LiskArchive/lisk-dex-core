module.exports = {
	root: true,
	parserOptions: {
		project: './tsconfig.json',
		tsconfigRootDir: __dirname,
	},
	extends: ['lisk-base/ts'],
	rules: {
		'@typescript-eslint/explicit-member-accessibility': 'off',
		'@typescript-eslint/explicit-function-return-type': 'off',
		'import/no-cycle': 'off',
		'@typescript-eslint/member-ordering': 'off',
		'@typescript-eslint/no-unsafe-argument': 'off',
	},
};
