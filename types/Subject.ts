// types/Subject.ts
export interface Subject {
  id?: string

  department_id: string

  course_code: string
  description: string

  lec?: number | null
  lab?: number | null
  units: number

  year_level_number: number
  year_level_label: string       // "1st Year", "2nd Year", etc.
  semester: "1ST" | "2ND" | "SUMMER"

  is_gened?: boolean

  created_by?: string | null
  created_at?: string
  updated_at?: string
}
