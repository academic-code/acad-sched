// /types/AcademicTerm.ts
export interface AcademicTerm {
  id: string
  semester: "1ST" | "2ND" | "SUMMER"
  academic_year: string // "2024-2025"
  label?: string | null
  is_active: boolean
}
