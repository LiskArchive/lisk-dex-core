.PHONY: all clean release logs mrproper

EXPECTED_NODEJS_VERSION := $(shell cat .nvmrc)
RUNNING_NODEJS_VERSION := $(shell node --version)
ifneq ($(RUNNING_NODEJS_VERSION),v$(EXPECTED_NODEJS_VERSION))
$(error Wrong Node.js version: $(RUNNING_NODEJS_VERSION) (expected: v$(EXPECTED_NODEJS_VERSION)))
endif

CORE_VERSION := $(shell jq --raw-output .version package.json)
ifneq ($(findstring alpha,$(CORE_VERSION)),)
CORE_CHANNEL := alpha
else ifneq ($(findstring beta,$(CORE_VERSION)),)
CORE_CHANNEL := beta
else ifneq ($(findstring rc,$(CORE_VERSION)),)
CORE_CHANNEL := rc
else ifneq ($(findstring canary,$(CORE_VERSION)),)
CORE_CHANNEL := canary
endif

all: node_modules dist/index.js release

yarn.lock: 
	git checkout yarn.lock
	touch -r yarn.lock

node_modules: yarn.lock
	yarn install --frozen-lockfile

dist/index.js: node_modules
	yarn build

ifndef $(CORE_VERSION)
release: dist/channels/$(CORE_CHANNEL)/lisk-dex-core-v$(CORE_VERSION)

dist/channels/$(CORE_CHANNEL)/lisk-dex-core-v$(CORE_VERSION):
	npx oclif-dev pack --targets=linux-x64,darwin-x64
else
release: dist/lisk-dex-core-v$(CORE_VERSION)

dist/lisk-dex-core-v$(CORE_VERSION):
	npx oclif-dev pack --targets=linux-x64,darwin-x64
endif

build: build-image build-local

build-image:
	docker buildx build -f ./docker/Dockerfile --build-arg NODEJS_VERSION=$(shell cat .nvmrc) --tag=lisk-dex/core --tag=lisk-dex/core:$(CORE_VERSION) .

build-local:
	yarn install --frozen-lockfile
	yarn build

clean: clean-image clean-local

clean-image:
	docker rmi lisk-dex/core; :

clean-local:
	rm -rf dist/ node_modules/

# Usage: make start ARGS="-n mainnet -l debug"
start: check-args
	docker run -d -p 7887:7887 -p 7667:7667 --name lisk-dex-core --rm lisk-dex/core start $(ARGS)

stop:
	docker stop lisk-dex-core; :

logs:
	docker logs lisk-dex-core

logs-live:
	docker logs lisk-dex-core --follow

# Usage: make run ARGS="start --help"
run: check-args
	docker run --name lisk-dex-core-temp --rm lisk-dex/core $(ARGS)

check-args:
ifndef ARGS
	$(error ARGS is undefined)
endif

mrproper: stop clean
