All instructions below assume that you have cloned the repo and ran `npm install`

- Running unit tests: `make test`

- Building locally: `make build` (outputs to `build/`)

- Running selenium integration tests:

  - Install your desired browsers to test against (Chrome, Firefox, Edge, Opera)
    - For Opera, download this webdriver: https://github.com/operasoftware/operachromiumdriver/releases
  - Setup your test AWS environment (TODO)
  - Create a `.env` file with these values (TODO):

  ```
  OPERA_DRIVER_PATH=
  ```

  - Make Selenium builds for your desired targets:

  ```
  # Build all targets
  SELENIUM=1 make build

  # Build just the specified targets. Valid options are chrome/firefox/edge/opera
  TARGETS="chrome opera" SELENIUM=1 make build
  ```

  - Test your desired targets:

  ```
   # Run all targets
  make selenium

  # Run just the specified targets. Valid options are chrome/firefox/edge/opera
  TARGETS="firefox edge" make selenium
  ```

  - After Selenium runs, optionally run unit tests (`make test`) for generating more coverage data
  - Generate a coverage report: `make coverage`
