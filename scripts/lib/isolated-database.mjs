import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFileSync, readdirSync } from 'node:fs'

/** Platform fixtures only. App schema, functions, policies and grants come from unchanged migrations. */
export async function createIsolatedDatabase() {
  const db = new PGlite({ extensions: { pgcrypto } })
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE ROLE supabase_auth_admin; CREATE ROLE supabase_storage_admin;
      CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SCHEMA extensions;
      CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
      SET search_path = public, extensions;
      CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}', raw_app_meta_data jsonb DEFAULT '{}');
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), current_user::text) $$;
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('sub',auth.uid(),'role',auth.role()) $$;
      GRANT USAGE ON SCHEMA public, auth, storage, extensions TO anon, authenticated, service_role;
      CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean DEFAULT false, file_size_limit bigint, allowed_mime_types text[]);
      CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text REFERENCES storage.buckets(id), name text, owner uuid, owner_id text, metadata jsonb);
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$ SELECT (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
      CREATE FUNCTION storage.filename(text) RETURNS text LANGUAGE sql AS $$ SELECT (string_to_array($1,'/'))[array_length(string_to_array($1,'/'),1)] $$;
      CREATE FUNCTION storage.extension(text) RETURNS text LANGUAGE sql AS $$ SELECT reverse(split_part(reverse($1),'.',1)) $$;
      INSERT INTO storage.buckets(id,name) VALUES ('receipts','receipts');
      GRANT ALL ON ALL TABLES IN SCHEMA storage TO service_role;
      GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon, authenticated;
      CREATE PUBLICATION supabase_realtime;
    `)
    const directory = new URL('../../supabase/migrations/', import.meta.url)
    const files = readdirSync(directory).filter(name => name.endsWith('.sql')).sort()
    for (const file of files) {
      try { await db.exec(readFileSync(new URL(file, directory), 'utf8')) }
      catch (error) { throw new Error(`Migration ${file}: ${error.message}`, { cause: error }) }
    }
    return { db, migrations: files.length }
  } catch (error) {
    await db.close()
    throw error
  }
}
