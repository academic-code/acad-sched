// FILE: server/api/schedules/list.get.ts
import { getQuery, createError } from 'h3'
import { extractBearerToken, getAppUserRecord } from './_helpers'

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const query = getQuery(event)

  const token = extractBearerToken(event)
  if (!token) throw createError({ statusCode: 401, message: 'Missing auth token.' })

  const { userRecord } = await getAppUserRecord(supabase, token)
  let userRole = (userRecord.role || '').toUpperCase()
  const userDepartmentId = userRecord.department_id

  // detect GENED dean
  if (userRole === 'DEAN' && userDepartmentId) {
    const { data: dept } = await supabase.from('departments').select('type').eq('id', userDepartmentId).maybeSingle()
    if (dept?.type === 'GENED') userRole = 'GENED'
  }

  const view = (query.view?.toString() || 'CLASS').toUpperCase()
  const targetId = query.target_id?.toString() || ''
  if (!targetId) throw createError({ statusCode: 400, message: 'target_id is required.' })

  // academic term - default to active
  let academicTermId = query.academic_term_id?.toString() || ''
  if (!academicTermId) {
    const { data: activeTerm } = await supabase.from('academic_terms').select('id').eq('is_active', true).maybeSingle()
    if (!activeTerm) throw createError({ statusCode: 400, message: 'No active academic term found.' })
    academicTermId = activeTerm.id
  }

  // Build request
  let request = supabase
    .from('schedules')
    .select(`
      id,
      class_id,
      subject_id,
      faculty_id,
      room_id,
      department_id,
      day,
      mode,
      academic_term_id,
      period_start_id,
      period_end_id,
      is_deleted,

      class:classes(id, class_name, section, year_level_label, program_name),
      subject:subjects(id, course_code, description, is_gened),
      faculty:faculty(id, first_name, last_name),
      room:rooms(id, name),

      period_start:periods!schedules_period_start_id_fkey(id, slot_index, start_time, end_time),
      period_end:periods!schedules_period_end_id_fkey(id, slot_index, start_time, end_time)
    `)
    .eq('academic_term_id', academicTermId)
    .eq('is_deleted', false)

  if (view === 'CLASS') request = request.eq('class_id', targetId)
  else if (view === 'FACULTY') request = request.eq('faculty_id', targetId)
  else if (view === 'ROOM') request = request.eq('room_id', targetId)
  else throw createError({ statusCode: 400, message: 'Invalid view type.' })

  if (userRole === 'FACULTY') {
    if (view !== 'FACULTY' || targetId !== userRecord.id) {
      throw createError({ statusCode: 403, message: 'Faculty can only view their own schedules.' })
    }
  }

  if (userRole === 'DEAN') {
    if (!userDepartmentId) throw createError({ statusCode: 403, message: 'Dean has no department.' })
    request = request.eq('department_id', userDepartmentId)
  }

  const { data, error } = await request.order('day', { ascending: true }).order('period_start.slot_index', { ascending: true })

  if (error) {
    console.error('schedules.list error:', error)
    throw createError({ statusCode: 500, message: error.message })
  }

  return (data || []).map((r: any) => ({ ...r }))
})
