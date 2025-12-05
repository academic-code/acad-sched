// /types/Subject.ts

export type Semester = "1ST" | "2ND" | "SUMMER"

export interface Subject {
  id?: string
  department_id: string
  course_code: string
  description: string
  lec: number
  lab: number
  units: number
  year_level_number: number
  year_level_label?: string
  semester: Semester
  academic_year: string
  curriculum_year: string
  is_gened: boolean
}
