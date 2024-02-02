![Lisk DEX: Core](docs/assets/banner_core.png 'Lisk DEX: Core')

# Lisk DEX: Core

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](http://www.apache.org/licenses/LICENSE-2.0)
![GitHub tag (latest by date)](https://img.shields.io/github/v/tag/liskhq/lisk-dex-core)
![GitHub repo size](https://img.shields.io/github/repo-size/liskhq/lisk-dex-core)
[![DeepScan grade](https://deepscan.io/api/teams/19600/projects/26306/branches/834300/badge/grade.svg?token=a1fa0980263b30233c0ddf1e9c3ed778290db2ee)](https://deepscan.io/dashboard#view=project&tid=19600&pid=26306&bid=834300)
![GitHub issues](https://img.shields.io/github/issues-raw/liskhq/lisk-dex-core)
![GitHub closed issues](https://img.shields.io/github/issues-closed-raw/liskhq/lisk-dex-core)

Lisk DEX: Core is a [UniSwap v3](https://blog.uniswap.org/uniswap-v3) inspired decentralized exchange blockchain application developed using the [Lisk SDK](https://github.com/LiskHQ/lisk-sdk).

## Project Index

Below is an index of the repositories which relate to this repository for easy navigation:

|     | Repository                                                                               | Description                                             |
| --- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------- |
|     | [Lisk DEX: Specs](https://github.com/LiskHQ/lisk-dex-specs?tab=readme-ov-file#index)     | The Lisk DEX blockchain specifications.                 |
| X   | [Lisk DEX: Core](https://github.com/LiskHQ/lisk-dex-core?tab=readme-ov-file#index)       | The Lisk DEX blockchain application.                    |
|     | [Lisk DEX: Service](https://github.com/LiskHQ/lisk-dex-service?tab=readme-ov-file#index) | The Lisk DEX blockchain middleware between Core and UI. |
|     | [Lisk DEX: UI](https://github.com/LiskHQ/lisk-dex-ui?tab=readme-ov-file#index)           | The Lisk DEX blockchain user-interface.                 |

## Modules

The Lisk DEX: Core blockchain application is composed of the following modules:

| Module                                          | Description                                                                                     |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [DEX](src/app/modules/dex)                      | Provides the main liquidity provision and swap functionality of the DEX blockchain.             |
| [DEX Governance](src/app/modules/dexGovernance) | Provides the proposals submission and proposal voting functionality of the DEX blockchain.      |
| [DEX Incentives](src/app/modules/dexIncentives) | Provides the minting and distribution of incentives for the native token of the DEX blockchain. |
| [DEX Rewards](src/app/modules/dexRewards)       | Defines the block reward scheme for the native token of the DEX blockchain.                     |

For the blockchain specifications relating to these modules, refer to [Lisk DEX: Specs](https://github.com/LiskHQ/lisk-dex-specs).

## Installation

### Dependencies

The following dependencies need to be installed in order to run this application:

| Dependency               | Version |
| ------------------------ | ------- |
| NodeJS                   | 18.16   |
| Python (for development) | 2.7.18  |

For information on installing these dependencies, refer to [Pre-installation Setup Guide](https://lisk.com/documentation/lisk-core/setup/source.html#source-pre-install).

### From Source

To install the application from source, execute the following commands:

```bash
git clone https://github.com/LiskHQ/lisk-dex-core.git
cd lisk-dex-core
git checkout development
npm i -g yarn
yarn install --frozen-lockfile
yarn run build
./bin/run --help
```

### With Docker

For information on setting up [Docker](https://www.docker.com/), refer to [Docker Setup Guide](https://lisk.com/documentation/lisk-core/setup/docker.html).

To build the docker image, execute the following command:

```bash
make build-image
```

## Tests

To run the tests without stress tests, execute the following command:

```bash
CI=true yarn test
```

To run the tests with stress tests, execute the following command:

```bash
yarn test
```

## Management

### From Source

To start the application process, execute the following command:

```bash
./bin/run start -n devnet --api-ws --api-ipc
```

Once the application process is started, Lisk DEX: Core is exposed accordingly:

```bash
0.0.0.0:7667 # WebSocket P2P port
0.0.0.0:7887 # WebSocket RPC port
```

To stop the application process, press the key combination:

```bash
CTRL+C
```

### With Docker

To start the application container, execute the following command:

```bash
make start ARGS="-n devnet --api-ws --api-ipc"
```

Once the application container is started, Lisk DEX: Core is exposed accordingly:

```bash
0.0.0.0:7667->7667 # WebSocket P2P port
0.0.0.0:7887->7887 # WebSocket RPC port
```

To stop the application container, execute the following command:

```bash
make stop
```

## Contributors

https://github.com/LiskHQ/lisk-dex-core/graphs/contributors

## Disclaimer

> [!WARNING]
> The source code of Lisk DEX: Core is considered to be a pre-release beta version that is subject to missing or incomplete features, bugs, and potential security flaws, and is therefore not suitable for usage in a production environment such as the Lisk Mainnet.
>
> By using the source code of Lisk DEX: Core, you acknowledge and agree that you have an adequate understanding of the risks associated with the use of the source code of Lisk DEX: Core and that it is provided on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. To the fullest extent permitted by law, in no event shall the Lisk Foundation or other parties involved in the development of Lisk DEX: Core have any liability whatsoever to any person for any direct or indirect loss, liability, cost, claim, expense or damage of any kind, whether in contract or in tort, including negligence, or otherwise, arising out of or related to the use of all or part of the source code of Lisk DEX: Core.

## License

Copyright 2016-2024 Lisk Foundation

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
