import { assertTestSupabaseUrl } from '@/lib/security/testSupabaseTarget.mjs'

const enabled = Object.entries(process.env).some(([key, value]) => key.endsWith('_INTEGRATION') && value === '1')
if (enabled) {
  const urls = Object.entries(process.env).filter(([key, value]) => key.endsWith('SUPABASE_URL') && Boolean(value))
  if (!urls.length) throw new Error('Integration requires an explicit cloud staging target')
  for (const [, value] of urls) assertTestSupabaseUrl(value!)
}
