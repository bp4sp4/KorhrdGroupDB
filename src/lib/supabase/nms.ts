import { createClient } from '@supabase/supabase-js'

export const nmsAdmin = createClient(
  process.env.NMS_SUPABASE_URL!,
  process.env.NMS_SUPABASE_SERVICE_ROLE_KEY!
)
