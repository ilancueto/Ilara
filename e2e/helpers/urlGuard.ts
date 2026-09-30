/** Shared cloud staging guard. Errors never include URLs or credentials. */
export {
  isAllowedTestSupabaseUrl as isAllowedE2ESupabaseUrl,
  assertTestSupabaseUrl as assertAllowedE2ESupabaseUrl,
  PROD_PROJECT_REF,
} from '../../lib/security/testSupabaseTarget.mjs'
