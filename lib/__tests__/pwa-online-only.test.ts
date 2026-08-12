import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function readPublic(name: string) {
  return fs.readFileSync(path.join(root, 'public', name), 'utf8')
}

function pngDimensions(filePath: string): { width: number; height: number } {
  const b = fs.readFileSync(filePath)
  expect(b[0]).toBe(0x89)
  expect(b[1]).toBe(0x50)
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }
}

describe('PWA online-only assets', () => {
  it('manifest declares standalone install metadata', () => {
    const manifest = JSON.parse(readPublic('manifest.json'))
    expect(manifest.name).toBeTruthy()
    expect(manifest.short_name).toBe('Ilara')
    expect(manifest.start_url).toBe('/')
    expect(manifest.scope).toBe('/')
    expect(manifest.display).toBe('standalone')
    expect(manifest.icons?.length).toBeGreaterThanOrEqual(2)
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes)
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
  })

  it('icons have real matching pixel dimensions', () => {
    const cases = [
      ['icon-192.png', 192],
      ['icon-512.png', 512],
      ['icon-512-maskable.png', 512],
      ['apple-touch-icon.png', 180],
    ] as const
    for (const [file, dim] of cases) {
      const { width, height } = pngDimensions(path.join(root, 'public', file))
      expect(width).toBe(dim)
      expect(height).toBe(dim)
    }
  })

  it('service worker is online-only (no cache responses)', () => {
    const swRaw = readPublic('sw.js')
    const sw = swRaw
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
    expect(sw).toMatch(/addEventListener\(\s*['"]install['"]/)
    expect(sw).toMatch(/addEventListener\(\s*['"]activate['"]/)
    expect(sw).toMatch(/addEventListener\(\s*['"]fetch['"]/)
    expect(sw).toMatch(/LEGACY_ILARA_CACHE/)
    expect(sw).toMatch(/caches\.keys/)
    expect(sw).toMatch(/caches\.delete/)
    expect(sw).not.toMatch(/keys\.map\(\(key\)\s*=>\s*caches\.delete\(key\)\)/)
    expect(sw).not.toMatch(/\.respondWith\s*\(/)
    expect(sw).not.toMatch(/caches\.open/)
    expect(sw).not.toMatch(/NetworkFirst|CacheFirst|defaultCache|precacheEntries/i)
    // Puede mencionar el nombre de cache histórico para eliminarlo; no puede
    // abrirlo ni responder solicitudes de Supabase desde el worker.
    expect(sw).toMatch(/ilara-supabase-catalog/)
    expect(sw).not.toMatch(/BackgroundSync|IndexedDB/i)
  })

  it('does not depend on Serwist in next config or package.json', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    expect(deps['serwist']).toBeUndefined()
    expect(deps['@serwist/next']).toBeUndefined()

    const nextConfig = fs.readFileSync(path.join(root, 'next.config.ts'), 'utf8')
    expect(nextConfig).not.toMatch(/serwist|withSerwist/i)
    expect(fs.existsSync(path.join(root, 'app', 'sw.ts'))).toBe(false)
  })
})
