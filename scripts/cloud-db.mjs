import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { cloudTestEnv } from './lib/cloud-test-env.mjs'

try {
  const { dbUrl } = cloudTestEnv({ database: true })
  const mode = process.argv[2]
  const commands = {
    prepare: ['db', 'push', '--db-url', dbUrl, '--include-seed', '--yes'],
    advisors: ['db', 'advisors', '--db-url', dbUrl, '--type', 'all', '--level', 'info'],
    security: ['db', 'advisors', '--db-url', dbUrl, '--type', 'security', '--level', 'warn', '--fail-on', 'warn'],
  }
  if (!commands[mode]) throw new Error('Use cloud-db.mjs prepare|advisors|security')
  let binary = process.env.SUPABASE_CLI_PATH || 'supabase'
  if (process.platform === 'win32' && !process.env.SUPABASE_CLI_PATH) {
    binary = join(process.env.APPDATA || '', 'npm', 'node_modules', 'supabase', 'dist', 'supabase.js')
    if (!existsSync(binary)) throw new Error('Set SUPABASE_CLI_PATH to the Supabase executable')
    commands[mode].unshift(binary)
    binary = process.execPath
  }
  const result = spawnSync(binary, commands[mode], { encoding: 'utf8', shell: false })
  // CLI errors may contain connection strings. Report only the operation and exit status.
  if (result.status !== 0) throw new Error(`Cloud ${mode} failed; verify staging access and connection`)
  console.log(`PASS: cloud staging ${mode}`)
} catch (error) { console.error(error.message); process.exitCode = 1 }
