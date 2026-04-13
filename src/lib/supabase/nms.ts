import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _instance: SupabaseClient | null = null

function getNmsAdmin(): SupabaseClient {
  if (!_instance) {
    _instance = createClient(
      process.env.NMS_SUPABASE_URL!,
      process.env.NMS_SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _instance
}

export const nmsAdmin = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const admin = getNmsAdmin()
    const val = (admin as unknown as Record<string | symbol, unknown>)[prop]
    return typeof val === 'function' ? (val as Function).bind(admin) : val
  },
})
