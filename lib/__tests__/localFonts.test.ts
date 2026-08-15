import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = process.cwd()
const layoutPath = join(projectRoot, 'app', 'layout.tsx')
const fontFiles = [
  'outfit-latin-wght-normal.woff2',
  'fraunces-latin-wght-normal.woff2',
  'great-vibes-latin-400-normal.woff2',
]

describe('local fonts', () => {
  it('does not depend on Google Fonts during builds', () => {
    const layout = readFileSync(layoutPath, 'utf8')

    expect(layout).toContain('next/font/local')
    expect(layout).not.toContain('next/font/google')
  })

  it.each(fontFiles)('ships %s with the application', (fileName) => {
    const fontPath = join(projectRoot, 'app', 'fonts', fileName)

    expect(statSync(fontPath).size).toBeGreaterThan(10_000)
  })
})
