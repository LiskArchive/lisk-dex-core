![image](https://user-images.githubusercontent.com/121556982/211871559-8d7ba9d1-32f5-4c73-aede-54352c5ef28e.png)

# Getting Started with Lisk Blockchain Client

This project was bootstrapped with [Lisk SDK](https://github.com/LiskHQ/lisk-sdk)

### Start a node

```
./bin/run start
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

## Learn More

You can learn more in the [documentation](https://lisk.com/documentation/lisk-sdk/).
