import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const headers = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve((request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (request.method !== 'POST') return new Response(null, { status: 405, headers })
  return new Response(JSON.stringify({
    success: false,
    error: {
      code: 'PASSKEYS_DISABLED',
      message: 'El acceso con passkeys no está disponible.',
    },
  }), { status: 403, headers })
})
