// server/api/schedules/_helpers.ts
import { createError } from "h3"

// Allowed normalized weekday values
export type ScheduleDay =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

type SupabaseClientLike = any

export function extractBearerToken(event: any): string | null {
  const headers = event.node?.req?.headers ?? {}
  const authHeader = headers.authorization ?? headers.Authorization ?? null
  if (!authHeader) return null
  const token = String(authHeader).replace(/^Bearer\s+/i, "").trim()
  return token || null
}

/**
 * Normalize the day string to the chosen canonical form.
 * We're using UPPERCASE (MONDAY, TUESDAY, ...).
 */
export function normalizeDay(value: string | null | undefined): ScheduleDay {
  return (value ?? "").toString().trim().toUpperCase() as ScheduleDay;
}

/**
 * Retrieve the app user record. This resolves:
 *  - supabase.auth.getUser(token) to get Auth user
 *  - users table row matching auth_user_id
 */
export async function getAppUserRecord(supabase: SupabaseClientLike, token: string) {
  const { data: authData, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !authData?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized." })
  }

  const { data: userRecord, error: userErr } = await supabase
    .from("users")
    .select("id, role, department_id, auth_user_id")
    .eq("auth_user_id", authData.user.id)
    .maybeSingle()

  if (userErr || !userRecord) {
    throw createError({ statusCode: 403, message: "User record not found." })
  }

  return { authUser: authData.user, userRecord }
}

export async function resolveNormalizedRole(supabase: SupabaseClientLike, userRecord: any) {
  const role = (userRecord?.role || "FACULTY").toString().toUpperCase()
  if (role !== "DEAN") return role

  const deptId = userRecord.department_id
  if (!deptId) return role

  const { data: dept, error: deptErr } = await supabase
    .from("departments")
    .select("type")
    .eq("id", deptId)
    .maybeSingle()

  if (deptErr) return role
  if (dept?.type === "GENED") return "GENED"
  return "DEAN"
}

export async function getFacultyRowByAuthUser(supabase: SupabaseClientLike, authUserId: string) {
  if (!authUserId) return null
  const { data: facultyRow, error } = await supabase
    .from("faculty")
    .select("id, auth_user_id, department_id, first_name, last_name")
    .eq("auth_user_id", authUserId)
    .maybeSingle()

  if (error) throw createError({ statusCode: 500, message: "Failed to lookup faculty." })
  return facultyRow || null
}

export function computeCanEdit(normalizedRole: string, userRecord: any, scheduleRow: any) {
  const role = (normalizedRole || "").toUpperCase()
  const subj = scheduleRow?.subject ?? {}
  const isGenEdSub = Boolean(subj?.is_gened)
  const subjDept = subj?.department_id ?? null
  const scheduleDept = scheduleRow?.department_id ?? null
  const userDept = userRecord?.department_id ?? null

  if (role === "ADMIN") return false
  if (role === "FACULTY") return false

  if (role === "GENED") {
    return isGenEdSub === true
  }

  if (role === "DEAN") {
    if (!userDept) return false
    if (isGenEdSub) return false
    return scheduleDept === userDept && subjDept === userDept
  }

  return false
}

export function formatScheduleForResponse(normalizedRole: string, userRecord: any, scheduleRow: any) {
  const normalizedDay = normalizeDay(scheduleRow?.day)
  const can_edit = computeCanEdit(normalizedRole, userRecord, scheduleRow)
  return {
    ...scheduleRow,
    day: normalizedDay,
    can_edit
  }
}

export function throwForbidden(message = "Forbidden") {
  throw createError({ statusCode: 403, message })
}

export function ensureArrayOfIds(input: any): string[] {
  if (!input) return []
  if (Array.isArray(input)) return input.map(String)
  return String(input).split(",").map(s => s.trim()).filter(Boolean)
}
