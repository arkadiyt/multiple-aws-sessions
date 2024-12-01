.PHONY: test lint

test:
	node --experimental-vm-modules node_modules/jest/bin/jest.js --errorOnDeprecated --randomize --verbose

lint:
	npx eslint

fmt:
	echo