import fs from 'node:fs';
import 'dotenv/config';

// Load all tests from the /tests directory
const tests = await Promise.all(
  fs
    .readdirSync('./test/tests')
    .map((filename) => `./tests/${filename}`)
    .map((pathname) => {
      return (async () => {
        const tests = await import(pathname);
        return {
          pathname,
          tests,
        };
      })();
    }),
);

const args = process.argv.slice(3);
const testArgs = {};
for (const arg of args) {
  // set --debug flag, etc.
  if (arg.startsWith('--')) {
    testArgs[arg.slice(2)] = true;
  }
}

// Run all tests
describe('Test suite', async () => {
  for (const test of tests) {
    if (!test.tests.run) {
      throw new Error(`No "run" function exported from "${test.pathname}"`);
    }
    await test.tests.run(testArgs);
  }
});
