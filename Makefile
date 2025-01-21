.PHONY: test lint lintfix fmt webpack clean build selenium coverage outdated

build:
	./scripts/build.sh

clean:
	rm -rf dist/* build/* coverage/*

webpack:
	npx webpack --watch

test:
	NODE_OPTIONS="--experimental-vm-modules" npx jest test/background

selenium:
	./scripts/selenium.sh

lint:
	npx eslint

lintfix:
	npx eslint --fix

fmt:
	npx prettier . --write

coverage:
	npx nyc -t coverage --reporter html --reporter text --report-dir coverage/summary report

outdated:
	npm outdated
