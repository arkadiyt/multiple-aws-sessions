/**
 * This file is only included when the extension is built with `SELENIUM=1 make build` or `SELENIUM=1 npx webpack`
 * If the SELENIUM env var is not set (e.g. for production builds) then when webpack is resolving
 * selenium/background.js it will include an empty file instead
 *
 * This file faciliates coverage testing when executing in a selenium environment
 */

// Istanbul writes coverage data into window.__coverage__
this.window = {};

// TODO add the hook to export coverage data
