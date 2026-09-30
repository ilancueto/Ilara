import { cloudTestEnv } from './lib/cloud-test-env.mjs'
try { cloudTestEnv({ database: true }); console.log('PASS: explicit cloud staging API and database target; production excluded') }
catch (error) { console.error(error.message); process.exitCode = 1 }
