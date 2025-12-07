// /types/Class.ts
export interface ClassRow {
  id?: string
  department_id: string
  year_level_number: number
  year_level_label: string
  section: string
  class_name: string
  adviser_id?: string | null
  remarks?: string | null
  is_archived?: boolean
  academic_term_id?: string | null
  created_by?: string | null
}

export interface ClassWithExtras extends ClassRow {
  academic_term?: {
    id: string
    semester: string
    academic_year: string
    label?: string | null
  } | null
  adviser?: {
    id: string
    first_name: string
    last_name: string
  } | null
}
