.PHONY: test lint lintfix fmt webpack clean buildchrome

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

buildchrome:
	./script/build.sh
