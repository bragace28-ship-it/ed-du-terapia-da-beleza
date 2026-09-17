import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const password = process.env.HOMOLOG_USER_PASSWORD

const professionals = [
  { email: 'carlos@ededuterapiadabeleza.online', name: 'Carlos' },
  { email: 'du@ededuterapiadabeleza.online', name: 'Du' },
  { email: 'ed@ededuterapiadabeleza.online', name: 'Ed / Edgar' },
] as const

if (!supabaseUrl || !serviceRoleKey || !password) {
  console.error('ERRO: defina SUPABASE_URL/VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e HOMOLOG_USER_PASSWORD.')
  process.exit(2)
}
if (password.length < 16) {
  console.error('ERRO: HOMOLOG_USER_PASSWORD deve ter pelo menos 16 caracteres.')
  process.exit(2)
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function findUser(email: string) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw error
  return data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null
}

async function main() {
  const { data: organizations, error: organizationError } = await admin
    .from('organizations')
    .select('id, name, active')
    .eq('active', true)
    .order('created_at', { ascending: true })
    .limit(1)
  if (organizationError) throw organizationError
  const organization = organizations?.[0]
  if (!organization) throw new Error('Nenhuma organização ativa foi encontrada.')

  console.log(`[staff] organização ativa: ${organization.name} (${organization.id})`)

  for (const person of professionals) {
    console.log(`[staff] provisionando ${person.email}`)
    let user = await findUser(person.email)

    if (user) {
      const { data, error } = await admin.auth.admin.updateUserById(user.id, {
        password,
        email_confirm: true,
        user_metadata: { full_name: person.name },
      })
      if (error) throw error
      user = data.user
      console.log(`[staff] usuário existente atualizado e confirmado: ${user?.id}`)
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: person.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: person.name },
      })
      if (error) throw error
      if (!data.user) throw new Error(`Supabase Auth não retornou o usuário ${person.email}.`)
      user = data.user
      console.log(`[staff] usuário criado e confirmado: ${user.id}`)
    }

    if (!user) throw new Error(`Usuário não disponível após provisionamento: ${person.email}`)

    const { error: profileError } = await admin.from('profiles').upsert({
      id: user.id,
      full_name: person.name,
      role: 'professional',
      active: true,
      organization_id: organization.id,
    }, { onConflict: 'id' })
    if (profileError) throw profileError

    const { error: memberError } = await admin.from('organization_members').upsert({
      organization_id: organization.id,
      user_id: user.id,
      role: 'professional',
      active: true,
    }, { onConflict: 'organization_id,user_id' })
    if (memberError) throw memberError

    const { data: existingProfessional, error: professionalLookupError } = await admin
      .from('professionals')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (professionalLookupError) throw professionalLookupError

    if (existingProfessional) {
      const { error } = await admin.from('professionals').update({
        name: person.name,
        active: true,
        organization_id: organization.id,
      }).eq('id', existingProfessional.id)
      if (error) throw error
    } else {
      const { error } = await admin.from('professionals').insert({
        user_id: user.id,
        name: person.name,
        active: true,
        organization_id: organization.id,
      })
      if (error) throw error
    }

    const { data: profile, error: verifyProfileError } = await admin
      .from('profiles')
      .select('id, full_name, role, active, organization_id')
      .eq('id', user.id)
      .single()
    if (verifyProfileError) throw verifyProfileError

    const { data: member, error: verifyMemberError } = await admin
      .from('organization_members')
      .select('user_id, role, active, organization_id')
      .eq('organization_id', organization.id)
      .eq('user_id', user.id)
      .single()
    if (verifyMemberError) throw verifyMemberError

    if (profile.role !== 'professional' || !profile.active || member.role !== 'professional' || !member.active) {
      throw new Error(`Perfil staff inconsistente após provisionamento: ${person.email}`)
    }

    console.log(`[staff] PASS ${person.email} · role=${profile.role} · organization=${profile.organization_id}`)
  }

  console.log('[staff] PROFESSIONALS_PROVISIONED=PASS')
  console.log('[staff] senha não é exibida no log por segurança.')
}

main().catch((error) => {
  console.error('[staff] PROFESSIONALS_PROVISIONED=FAIL')
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
