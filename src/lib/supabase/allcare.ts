import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _instance: SupabaseClient | null = null

function getAllcareAdmin(): SupabaseClient {
  if (!_instance) {
    _instance = createClient(
      process.env.ALLCARE_SUPABASE_URL!,
      process.env.ALLCARE_SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _instance
}

export const allcareAdmin = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const admin = getAllcareAdmin()
    const val = (admin as unknown as Record<string | symbol, unknown>)[prop]
    return typeof val === 'function' ? (val as Function).bind(admin) : val
  },
})
