![image](https://user-images.githubusercontent.com/121556982/211871559-8d7ba9d1-32f5-4c73-aede-54352c5ef28e.png)

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](http://www.apache.org/licenses/LICENSE-2.0)
![GitHub tag (latest by date)](add link to image)
![GitHub repo size](add link to image)
[![DeepScan grade](https://deepscan.io/api/teams/6759/projects/8870/branches/113510/badge/grade.svg)](https://deepscan.io/dashboard/#view=project&tid=6759&pid=8870&bid=113510)
![GitHub issues]
![GitHub closed issues]
[![Code coverage]]

# Lisk DEX Core

This project was bootstrapped with [Lisk SDK](https://github.com/LiskHQ/lisk-sdk)

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

## Learn More

You can learn more in the [documentation](https://lisk.com/documentation/lisk-sdk/).
