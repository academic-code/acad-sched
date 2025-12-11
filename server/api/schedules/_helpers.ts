// FILE: server/api/schedules/_helpers.ts
// Shared helper utilities used by the schedules endpoints
import { createError } from 'h3'

export function extractBearerToken(event: any): string | null {
  const headers = event.node?.req?.headers ?? {}
  const authHeader = headers.authorization ?? headers.Authorization ?? null
  if (!authHeader) return null
  return String(authHeader).replace(/^Bearer\s+/i, '') || null
}

export async function getAppUserRecord(supabase: any, token: string) {
  const { data: authData, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !authData?.user) throw createError({ statusCode: 401, message: 'Unauthorized.' })

  const { data: userRecord, error: userErr } = await supabase
    .from('users')
    .select('id, role, department_id, auth_user_id')
    .eq('auth_user_id', authData.user.id)
    .maybeSingle()

  if (userErr || !userRecord) throw createError({ statusCode: 403, message: 'User record not found.' })
  return { authUser: authData.user, userRecord }
}