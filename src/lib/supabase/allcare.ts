import { createClient } from '@supabase/supabase-js'

export const allcareAdmin = createClient(
  process.env.ALLCARE_SUPABASE_URL!,
  process.env.ALLCARE_SUPABASE_SERVICE_ROLE_KEY!
)
