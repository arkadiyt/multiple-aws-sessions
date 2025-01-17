.PHONY: test lint lintfix fmt webpack clean build selenium

build:
	./scripts/build.sh

clean:
	rm -rf dist/* build/* coverage/*

webpack:
	npx webpack --watch

test:
	NODE_OPTIONS="--experimental-vm-modules" npx jest test/background

selenium:
	# SELENIUM=1 ./scripts/build.sh
	./scripts/selenium.sh
	
lint:
	npx eslint

lintfix:
	npx eslint --fix

fmt:
	npx prettier . --write
