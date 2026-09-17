import { createClient } from '@supabase/supabase-js'

const email = process.env.HOMOLOG_USER_EMAIL ?? 'admin.homologacao@ededuterapiadabeleza.online'
const password = process.env.HOMOLOG_USER_PASSWORD
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey || !password) {
  console.error('ERRO: defina SUPABASE_URL/VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e HOMOLOG_USER_PASSWORD.')
  process.exit(2)
}
if (password.length < 16) {
  console.error('ERRO: HOMOLOG_USER_PASSWORD deve ter pelo menos 16 caracteres.')
  process.exit(2)
}

const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

async function main() {
  console.log(`[homolog] iniciando provisionamento: ${email}`)
  const { data: users, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listError) throw listError
  const existing = users.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())

  let userId: string
  if (existing) {
    userId = existing.id
    const { error } = await admin.auth.admin.updateUserById(userId, { password, email_confirm: true })
    if (error) throw error
    console.log(`[homolog] usuário existente atualizado e confirmado: ${userId}`)
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (error) throw error
    if (!data.user) throw new Error('Supabase Auth não retornou o usuário criado.')
    userId = data.user.id
    console.log(`[homolog] usuário criado e confirmado: ${userId}`)
  }

  // A trigger on_auth_user_created_eddu creates the initial profile/org membership.
  // The SQL seed remains the authoritative promotion/catalog seed and is run separately.
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, role, active, organization_id')
    .eq('id', userId)
    .maybeSingle()
  if (profileError) throw profileError
  console.log(`[homolog] trigger/profile: ${JSON.stringify(profile)}`)

  if (!profile) {
    throw new Error('Perfil não foi criado pela trigger de Auth; abortando homologação.')
  }

  console.log('[homolog] AUTH_PROVISIONED=PASS')
  console.log(`[homolog] user_id=${userId}`)
  console.log('[homolog] senha não é exibida no log por segurança.')
}

main().catch((error) => {
  console.error('[homolog] AUTH_PROVISIONED=FAIL')
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
