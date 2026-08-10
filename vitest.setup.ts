// Optional: add @testing-library/jest-dom if you add React component tests
// import '@testing-library/jest-dom'

// Cliente Supabase de browser se instancia al importar lib/supabase.ts.
// Valores dummy solo para tests unitarios (no son secretos reales).
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://example.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder'
