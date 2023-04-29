![image](https://user-images.githubusercontent.com/121556982/211871559-8d7ba9d1-32f5-4c73-aede-54352c5ef28e.png)

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](http://www.apache.org/licenses/LICENSE-2.0)

<!-- ![GitHub tag (latest by date)](add link to image)
![GitHub repo size](add link to image) -->

[![DeepScan grade]]

<!-- ![GitHub issues]
![GitHub closed issues]
[![Code coverage]] -->

# Lisk DEX Core

The Lisk DEX is a decentralized application built with the Lisk SDK v6.0.0 and on the Lisk blockchain. This project was bootstrapped with [Lisk SDK](https://github.com/LiskHQ/lisk-sdk)

The Lisk DEX is a program that provides the core functionality for implementing all liquidity operations.

This document details how to install Lisk DEX Core from source and from the npm registry. If you have satisfied the requirements from the Pre-Installation section, you can jump directly to the next section Installation Steps.

## Index

- [Installation](#installation)
- [Managing Lisk Node](#managing-lisk-node)
- [Configuring Nodes, Modules, Assets, and Plugins.](#configuring-lisk-node)
- [Tests](#tests)
- [License](#license)

## Installation

### Dependencies

The following dependencies need to be installed in order to run applications created with the Lisk SDK:

| Dependencies             | Version |
| ------------------------ | ------- |
| NodeJS                   | 16.20   |
| Python (for development) | 2.7.18  |

You can find further details on installing these dependencies in our [pre-installation setup guide](https://lisk.com/documentation/lisk-core/setup/source.html#source-pre-install).
Clone the Lisk DEX Core repository using Git and initialize the modules.

### From Source

```bash
git clone https://github.com/LiskHQ/lisk-dex-core
cd lisk-core
git checkout main
nvm install
npm ci
npm run build
./bin/run --help
```

## Managing Lisk Node

### System requirements

The following system requirements are recommended for validator nodes:

#### Memory

- Machines with a minimum of 4 GB RAM for the Mainnet.
- Machines with a minimum of 2 GB RAM for the Testnet.

#### Storage

- Machines with a minimum of 40 GB HDD.

#### OS

- Ubuntu 20.04
- Ubuntu 18.04

## Configuring Lisk Nodes, Modules, Assets and Plugins

### Start a node

```
./bin/run start -n devnet --api-ws --api-ipc
```

### Add a new module

```
lisk generate:module ModuleName ModuleID
// Example
lisk generate:module token 1
```

### Add a new asset

```
lisk generate:asset ModuleName AssetName AssetID
// Example
lisk generate:asset token transfer 1
```

### Add a new plugin

```
lisk generate:plugin PluginName
// Example
lisk generate:plugin httpAPI
```

## Tests

### Automated tests

All automated tests will run with the below command.

```
npm test
```

## Contributors

https://github.com/LiskHQ/lisk-dex-core/graphs/contributors

## License

Copyright 2016-2023 Lisk Foundation

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

[lisk documentation site]: https://lisk.com/documentation/lisk-core/

## Learn More

You can learn more in the [documentation](https://lisk.com/documentation/lisk-sdk/).
