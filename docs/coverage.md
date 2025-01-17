- jest does coverage with babel/istanbul by default, works for pure JS tests
- but for integration tests in selenium, the javascript is transpiled/bundled so:

1. need to instrument with coverage data ourselves
2. need to add sourcemap data so we can tie the lines back to our code correctly
3. need to export from selenium process
