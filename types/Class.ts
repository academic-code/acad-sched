// /types/Class.ts

export type SemesterType = "1ST" | "2ND" | "SUMMER"

// Use the REAL AcademicTerm definition
export type { AcademicTerm } from "./AcademicTerm"

export interface FacultyOption {
  id: string
  full_name: string
}

export interface ClassFormPayload {
  id?: string
  class_name: string
  program_name: string
  year_level_number: number
  section: string
  adviser_id: string | null
  remarks?: string
  academic_term_id: string | null
}
