/**
 * Validación de variables de entorno al arranque.
 * Si falta alguna obligatoria, lanza con mensaje claro.
 */

const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
] as const;

export function validateEnv(): void {
  const missing = required.filter((key) => {
    const v = process.env[key];
    return v === undefined || v === '';
  });
  if (missing.length > 0) {
    throw new Error(
      `Faltan variables de entorno: ${missing.join(', ')}. Revisá .env.local y .env.example.`
    );
  }
}

export function getEnv<K extends (typeof required)[number]>(
  key: K
): string {
  const v = process.env[key];
  if (v === undefined || v === '') {
    throw new Error(`Variable de entorno requerida no definida: ${key}`);
  }
  return v;
}
