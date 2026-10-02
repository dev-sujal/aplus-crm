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

export const QUESTION_TYPES = ["single", "multiple"] as const
export type QuestionType = (typeof QUESTION_TYPES)[number]

export const QUESTION_DIFFICULTIES = ["easy", "medium", "hard"] as const
export type QuestionDifficulty = (typeof QUESTION_DIFFICULTIES)[number]

export const TEST_STATUSES = ["draft", "published", "archived"] as const
export type TestStatus = (typeof TEST_STATUSES)[number]

export const ASSIGNMENT_STATUSES = ["not_started", "in_progress", "submitted", "expired", "revoked"] as const
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number]

export const ATTEMPT_STATUSES = ["in_progress", "submitted", "auto_submitted", "expired"] as const
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number]

export const MULTI_ANSWER_SCORING = ["all_correct", "partial"] as const
export type MultiAnswerScoringMode = (typeof MULTI_ANSWER_SCORING)[number]

export const SUBMISSION_MODES = ["manual", "auto"] as const
export type SubmissionMode = (typeof SUBMISSION_MODES)[number]

export interface QuestionOptionSnapshot {
  id: string
  text: string
}

export interface QuestionSnapshot {
  type: QuestionType
  text: string
  options: QuestionOptionSnapshot[]
  correctOptionIds: string[]
  marks: number
  explanation: string
  topic: string
  difficulty: QuestionDifficulty
}

export interface TestQuestionSnapshot {
  questionId: string
  snapshot: QuestionSnapshot
  order: number
}

export interface Question {
  id: string
  course: string | Course
  type: QuestionType
  text: string
  options: QuestionOptionSnapshot[]
  correctOptionIds: string[]
  marks: number
  explanation: string
  topic: string
  difficulty: QuestionDifficulty
  status: "active" | "archived"
  archivedAt: string | null
  createdBy: string
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface TestQuestion extends TestQuestionSnapshot {
  id?: string
}

export interface Test {
  id: string
  course: string | Course
  title: string
  instructions: string
  timeLimitMinutes: number
  passPercentage: number
  multiAnswerScoring: MultiAnswerScoringMode
  negativeMarking: boolean
  negativeMarkingRate: number
  shuffleQuestions: boolean
  shuffleOptions: boolean
  showResultImmediately: boolean
  status: TestStatus
  publishedAt: string | null
  questions: TestQuestionSnapshot[]
  questionCount?: number
  createdBy: string
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface TestAssignment {
  id: string
  test: string | Test
  course: string | Course
  student: string | Student
  shareToken: string
  availabilityStart: string | null
  availabilityEnd: string | null
  attemptsAllowed: number
  status: AssignmentStatus
  revokedAt: string | null
  latestAttemptId: string | null
  lastAttemptAt: string | null
  assignedBy: string
  createdAt: string
  updatedAt: string
}

export interface QuestionScoreResult {
  questionId: string
  selectedOptionIds: string[]
  correctOptionIds: string[]
  isCorrect: boolean
  isPartiallyCorrect: boolean
  isUnanswered: boolean
  marksAwarded: number
  maxMarks: number
}

export interface TopicPerformanceSnapshot {
  topic: string
  questionCount: number
  correctCount: number
  wrongCount: number
  partiallyCorrectCount: number
  unansweredCount: number
  marksAwarded: number
  maxMarks: number
  percentage: number
}

export interface TestAttemptResult {
  score: number
  totalMarks: number
  percentage: number
  passed: boolean
  correctCount: number
  wrongCount: number
  partiallyCorrectCount: number
  unansweredCount: number
  timeTakenSeconds: number
  submissionMode: SubmissionMode
  questionResults: QuestionScoreResult[]
  topicPerformance: TopicPerformanceSnapshot[]
}

export interface TestAttempt {
  id: string
  assignment: string | TestAssignment
  test: string | Test
  course: string | Course
  student: string | Student
  attemptNumber: number
  status: AttemptStatus
  startedAt: string | null
  submittedAt: string | null
  expiresAt: string | null
  lastSavedAt: string | null
  currentQuestionIndex: number
  testSnapshot: {
    title: string
    instructions: string
    timeLimitMinutes: number
    passPercentage: number
    multiAnswerScoring: MultiAnswerScoringMode
    negativeMarking: boolean
    negativeMarkingRate: number
    shuffleQuestions: boolean
    shuffleOptions: boolean
    showResultImmediately: boolean
    questions: TestQuestionSnapshot[]
  }
  answers: Array<{
    questionId: string
    selectedOptionIds: string[]
    markedForReview: boolean
    answeredAt: string | null
  }>
  presentation: {
    questionOrder: string[]
    optionOrder: Array<{
      questionId: string
      optionIds: string[]
    }>
  }
  result: TestAttemptResult | null
  createdAt: string
  updatedAt: string
}

export interface TestStatsQuestionStat {
  questionId: string
  correctCount: number
  wrongCount: number
  partiallyCorrectCount: number
  unansweredCount: number
  wrongOptionCounts: Array<{ optionId: string; count: number }>
  mostChosenWrongOptionId: string
  mostChosenWrongOptionText: string
}

export interface TestStatsTopicStat {
  topic: string
  attemptCount?: number
  averagePercentage: number
  strongCount: number
  weakCount: number
}

export interface TestStats {
  id: string
  test: string | Test
  course: string | Course
  attemptsCount: number
  averageScore: number
  highestScore: number
  lowestScore: number
  passedCount: number
  failedCount: number
  passRate: number
  scoreDistribution: Array<{ label: string; count: number }>
  questionStats: TestStatsQuestionStat[]
  topicStats: TestStatsTopicStat[]
  updatedAtSummary: string | null
}

export interface StudentPerformanceScoreTrend {
  attempt: string
  test: string | Test
  title: string
  score: number
  percentage: number
  takenAt: string
  passed: boolean
}

export interface StudentPerformanceTopicStat {
  topic: string
  averagePercentage: number
  attemptsCount: number
  weakCount: number
  strongCount: number
}

export interface StudentPerformance {
  id: string
  student: string | Student
  testsTaken: number
  averagePercentage: number
  bestPercentage: number
  latestPercentage: number
  passedCount: number
  failedCount: number
  scoreTrend: StudentPerformanceScoreTrend[]
  weakTopics: StudentPerformanceTopicStat[]
  strongTopics: StudentPerformanceTopicStat[]
  updatedAtSummary: string | null
}

export interface AnalyticsOverview {
  tests: number
  publishedTests: number
  assignments: number
  attempts: number
  averageTestPassRate: number
  averageStudentPercentage: number
  topStudents: StudentPerformance[]
}

export interface CourseComparisonRow {
  courseId: string
  title: string
  tests: number
  attempts: number
  averagePassRate: number
}

export interface AssignmentShareResponse {
  shareToken: string
  assignmentId: string
  status: AssignmentStatus
  availabilityStart: string | null
  availabilityEnd: string | null
  attemptsAllowed: number
  test: Test & { questions: TestQuestionSnapshot[] }
  student: Student
  course: Course
}

export interface PublicAttemptStartResponse {
  assignmentId: string
  shareToken: string
  attemptId: string
  status: AttemptStatus
  startedAt: string
  expiresAt: string
  currentQuestionIndex: number
  test: {
    title: string
    instructions: string
    timeLimitMinutes: number
    passPercentage: number
    showResultImmediately: boolean
    questions: TestQuestionSnapshot[]
  }
  student: Student
  course: Course
  answers: Array<{
    questionId: string
    selectedOptionIds: string[]
    markedForReview: boolean
    answeredAt?: string | null
  }>
}

export interface PublicAttemptResultResponse {
  submitted: boolean
  visible: boolean
  result?: TestAttemptResult
  attempt?: TestAttempt
}
