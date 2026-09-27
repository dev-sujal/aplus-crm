export const PERMISSION_MODULES = [
  "students",
  "attendance",
  "fees",
  "courses",
  "certificates",
] as const

export type PermissionModule = (typeof PERMISSION_MODULES)[number]

export interface ModulePermission {
  view: boolean
  edit: boolean
}

export type Permissions = Record<PermissionModule, ModulePermission>

export type Role = "owner" | "admin"

export interface AuthUser {
  id: string
  firstName: string
  lastName: string
  email: string
  role: Role
  permissions: Permissions
  status?: "active" | "disabled"
}

export interface Course {
  id: string
  title: string
  description: string
  durationWeeks: number | null
  fee: number
  startDate: string | null
  endDate: string | null
  category: string
  tags: string[]
  status: "active" | "inactive"
  maxSeats: number | null
  instructorName: string
  createdBy: string
  createdAt: string
  updatedAt: string
  enrolledCount?: number
}

export interface Student {
  id: string
  firstName: string
  lastName: string
  photoUrl: string
  email: string
  phone: string
  address: string
  dob: string | null
  guardianContact: string
  gender: "male" | "female" | "other" | ""
  createdAt: string
  updatedAt: string
  enrollments?: Enrollment[]
}

export interface EnrollmentCourseRef {
  id: string
  title: string
  fee: number
  status: "active" | "inactive"
}

export interface EnrollmentStudentRef {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  photoUrl: string
}

export interface Enrollment {
  id: string
  student: EnrollmentStudentRef | string
  course: EnrollmentCourseRef | string
  registrationDate: string
  batch: string
  status: "ongoing" | "completed" | "dropped"
  createdAt: string
}

export type AttendanceStatus = "present" | "absent" | "late"

export interface AttendanceRosterEntry {
  enrollment: string
  student: EnrollmentStudentRef
  status: AttendanceStatus | null
}

export interface AttendanceRecord {
  id: string
  enrollment: string | (Enrollment & { course?: EnrollmentCourseRef })
  date: string
  status: AttendanceStatus
  markedBy: string
}

export interface AttendanceSummary {
  total: number
  present: number
  absent: number
  late: number
  percentage: number
}

export type PaymentMode =
  | "cash"
  | "upi"
  | "card"
  | "bank_transfer"
  | "other"
  | "online"
  | "offline"

export interface Payment {
  id: string
  date: string
  amount: number
  mode: PaymentMode
  note: string
  receiptNo: string
}

export interface Fee {
  id: string
  enrollment: string | (Enrollment & { course?: EnrollmentCourseRef; student?: EnrollmentStudentRef })
  totalFee: number
  amountPaid: number
  amountRemaining: number
  dueDate: string | null
  payments: Payment[]
}

export interface FeeSummary {
  totalCollected: number
  totalPending: number
  overdueCount: number
  overdue: Fee[]
  recentPayments: Array<{
    id: string
    feeId: string
    enrollmentId: string
    studentId: string
    studentName: string
    courseName: string
    amount: number
    mode: PaymentMode
    note: string
    receiptNo: string
    date: string
  }>
}

export interface Certificate {
  id: string
  enrollment: string
  credentialId: string
  issueDate: string
  completionDate: string | null
  issuerName: string
  templateId: string
  studentName?: string
  courseName?: string
  verifyUrl?: string
}

export interface VerifyResult {
  valid: boolean
  message?: string
  credentialId?: string
  studentName?: string
  courseName?: string
  issueDate?: string
  completionDate?: string | null
  issuingCentre?: string
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}
