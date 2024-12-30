.PHONY: test lint lintfix fmt webpack clean build

clean:
	rm -rf dist/* build/*

webpack:
	npx webpack --watch

test:
	NODE_OPTIONS="--experimental-vm-modules" npx jest

lint:
	npx eslint

lintfix:
	npx eslint --fix

fmt:
	npx prettier . --write

build:
	./scripts/build.sh