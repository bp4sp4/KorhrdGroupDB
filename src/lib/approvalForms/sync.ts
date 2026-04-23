import { supabaseAdmin } from '@/lib/supabase/admin'

export interface SyncParams {
  document_type: string
  category_id: string | null
  default_approval_template_id: string
  is_active: boolean
  sort_order: number
}

/**
 * approval_form_templates → approval_templates 동기화.
 * 같은 document_type으로 upsert, steps는 default_approval_template_id에서 복사.
 */
export async function syncApprovalTemplate(params: SyncParams): Promise<string | null> {
  const { document_type, category_id, default_approval_template_id, is_active, sort_order } = params

  let categoryName = '기타'
  if (category_id) {
    const { data: cat } = await supabaseAdmin
      .from('approval_form_categories')
      .select('name')
      .eq('id', category_id)
      .single()
    if (cat?.name) categoryName = cat.name
  }

  const { data: src } = await supabaseAdmin
    .from('approval_templates')
    .select('steps')
    .eq('id', default_approval_template_id)
    .single()

  const steps = src?.steps ?? []

  const { data: existing } = await supabaseAdmin
    .from('approval_templates')
    .select('id')
    .eq('document_type', document_type)
    .maybeSingle()

  if (existing?.id) {
    const { data: upd } = await supabaseAdmin
      .from('approval_templates')
      .update({ category: categoryName, steps, is_active, sort_order })
      .eq('id', existing.id)
      .select('id')
      .single()
    return upd?.id ?? existing.id
  }

  const { data: ins } = await supabaseAdmin
    .from('approval_templates')
    .insert({ document_type, category: categoryName, steps, is_active, sort_order })
    .select('id')
    .single()
  return ins?.id ?? null
}

export async function deactivateSyncedTemplate(synced_template_id: string): Promise<void> {
  await supabaseAdmin
    .from('approval_templates')
    .update({ is_active: false })
    .eq('id', synced_template_id)
}
