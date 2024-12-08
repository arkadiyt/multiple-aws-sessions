.PHONY: test lint lintfix fmt build webpack clean

clean:
	rm -rf dist/*

webpack:
	npx webpack

test:
	NODE_OPTIONS="--experimental-vm-modules" npx jest

lint:
	npx eslint

lintfix:
	npx eslint --fix

fmt:
	npx prettier . --write

build:
	echo # TODO
