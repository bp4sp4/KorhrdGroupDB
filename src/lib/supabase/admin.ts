import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _instance: SupabaseClient | null = null

function getAdmin(): SupabaseClient {
  if (!_instance) {
    _instance = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _instance
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const admin = getAdmin()
    const val = (admin as unknown as Record<string | symbol, unknown>)[prop]
    return typeof val === 'function' ? (val as Function).bind(admin) : val
  },
})
