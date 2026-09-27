import * as React from "react"
import { useParams, Link, useSearchParams } from "react-router-dom"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ArrowLeft, Award, Download, Plus } from "lucide-react"
import { api, ApiRequestError, API_URL } from "#lib/api-client"
import { useAuth } from "#providers/auth-context"
import type {
  AttendanceRecord,
  AttendanceSummary,
  Certificate,
  Course,
  Enrollment,
  EnrollmentCourseRef,
  Fee,
  PaginatedResult,
  Student,
} from "#lib/types"
import { Button } from "#components/ui/button"
import { Label } from "#components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "#components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "#components/ui/dialog"
import { cn } from "cn"

const tabs = [
  { id: "courses", label: "Courses" },
  { id: "attendance", label: "Attendance" },
  { id: "fees", label: "Fees" },
  { id: "certificates", label: "Certificates" },
] as const
type TabId = (typeof tabs)[number]["id"]

function isTabId(value: string): value is TabId {
  return tabs.some((tab) => tab.id === value)
}

function isObjectId(value: string | undefined): value is string {
  return Boolean(value && /^[a-f\d]{24}$/i.test(value))
}

const enrollSchema = z.object({
  course: z
    .string()
    .regex(/^[a-f\d]{24}$/i, "Select a valid course"),
  batch: z.string().optional().default(""),
})
type EnrollInput = z.input<typeof enrollSchema>
type EnrollValues = z.output<typeof enrollSchema>

const paymentSchema = z.object({
  amount: z.coerce.number().positive("Enter an amount greater than 0"),
  mode: z.enum(["cash", "upi", "card", "bank_transfer", "other", "online", "offline"]).default("cash"),
  note: z.string().optional().default(""),
  receiptNo: z.string().optional().default(""),
})
type PaymentInput = z.input<typeof paymentSchema>
type PaymentValues = z.output<typeof paymentSchema>

const studentFeePaymentSchema = z.object({
  enrollmentId: z.string().min(1, "Select a course fee"),
  amount: z.coerce.number().positive("Enter an amount greater than 0"),
  mode: z.enum(["cash", "upi", "card", "bank_transfer", "other", "online", "offline"]).default("cash"),
  note: z.string().optional().default(""),
  receiptNo: z.string().optional().default(""),
})
type StudentFeePaymentInput = z.input<typeof studentFeePaymentSchema>
type StudentFeePaymentValues = z.output<typeof studentFeePaymentSchema>

const certificateSchema = z.object({
  completionDate: z.string().optional().default(""),
  issuerName: z.string().optional().default(""),
})
type CertificateInput = z.input<typeof certificateSchema>
type CertificateValues = z.output<typeof certificateSchema>

interface StudentCertificateRow {
  enrollment: string
  courseName: string
  enrollmentStatus: "ongoing" | "completed" | "dropped"
  certificate: Certificate | null
}

function formatCurrency(n: number) {
  return `₹${n.toLocaleString("en-IN")}`
}

function formatPaymentMode(mode: string) {
  if (mode === "online") return "Online"
  if (mode === "offline") return "Offline"
  return mode.replace(/_/g, " ")
}

function getEnrollmentId(fee: Fee): string {
  const enrollment = typeof fee.enrollment === "object" ? fee.enrollment : null
  return enrollment && typeof enrollment === "object" ? enrollment.id : ""
}

function getCourseId(course: Course): string {
  const fallbackId = (course as unknown as { _id?: string })._id
  return course.id || fallbackId || ""
}

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const { user, can } = useAuth()
  const queryClient = useQueryClient()
  const [tab, setTab] = React.useState<TabId>("courses")
  const [enrollOpen, setEnrollOpen] = React.useState(false)
  const [paymentDialogFeeId, setPaymentDialogFeeId] = React.useState<string | null>(null)
  const [certDialogEnrollmentId, setCertDialogEnrollmentId] = React.useState<string | null>(null)
  const canManageStudents = user?.role === "owner" || can("students", "edit")
  const canManageFees = user?.role === "owner"
  const canViewCertificates = user?.role === "owner" || can("certificates", "view")
  const canGenerateCertificates = user?.role === "owner" || can("certificates", "edit")
  const studentId = isObjectId(id) ? id : null

  const visibleTabs = React.useMemo(
    () => tabs.filter((t) => (t.id === "fees" ? canManageFees : t.id === "certificates" ? canViewCertificates : true)),
    [canManageFees, canViewCertificates]
  )

  React.useEffect(() => {
    const tabFromUrl = searchParams.get("tab")
    if (tabFromUrl && isTabId(tabFromUrl) && visibleTabs.some((t) => t.id === tabFromUrl)) {
      setTab(tabFromUrl)
      return
    }
    if (!visibleTabs.some((t) => t.id === tab)) {
      setTab(visibleTabs[0]?.id ?? "courses")
    }
  }, [searchParams, tab, visibleTabs])

  const { data: student, isLoading } = useQuery({
    queryKey: ["student", studentId],
    queryFn: () => api.get<Student & { enrollments: Enrollment[] }>(`/students/${studentId}`),
    enabled: Boolean(studentId),
  })

  const { data: activeCourses } = useQuery({
    queryKey: ["courses", "active-for-enroll"],
    queryFn: () => api.get<PaginatedResult<Course>>("/courses?status=active&limit=100"),
    enabled: enrollOpen,
  })

  const { data: attendance } = useQuery({
    queryKey: ["student-attendance", studentId],
    queryFn: () =>
      api.get<{ records: AttendanceRecord[]; summary: AttendanceSummary }>(
        `/attendance?student=${studentId}`
      ),
    enabled: Boolean(studentId) && tab === "attendance",
  })

  const { data: fees } = useQuery({
    queryKey: ["student-fees", studentId],
    queryFn: () => api.get<Fee[]>(`/fees/student/${studentId}`),
    enabled: Boolean(studentId) && tab === "fees" && canManageFees,
  })

  const feeSummary = React.useMemo(() => {
    const items = fees ?? []
    return {
      totalFee: items.reduce((sum, fee) => sum + fee.totalFee, 0),
      amountPaid: items.reduce((sum, fee) => sum + fee.amountPaid, 0),
      amountRemaining: items.reduce((sum, fee) => sum + fee.amountRemaining, 0),
      paymentCount: items.reduce((sum, fee) => sum + fee.payments.length, 0),
    }
  }, [fees])

  const [selectedEnrollmentId, setSelectedEnrollmentId] = React.useState("")

  const {
    register: registerPayment,
    handleSubmit: handlePaymentSubmit,
    reset: resetPayment,
    formState: { isSubmitting: isSubmittingPayment },
  } = useForm<PaymentInput, unknown, PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: undefined, mode: "cash", note: "", receiptNo: "" },
  })

  const {
    register: registerFeePayment,
    handleSubmit: handleFeePaymentSubmit,
    reset: resetFeePayment,
    formState: { isSubmitting: isSubmittingFeePayment },
  } = useForm<StudentFeePaymentInput, unknown, StudentFeePaymentValues>({
    resolver: zodResolver(studentFeePaymentSchema),
    defaultValues: { enrollmentId: "", amount: undefined, mode: "offline", note: "", receiptNo: "" },
  })

  React.useEffect(() => {
    if (!fees?.length) return
    if (!selectedEnrollmentId || !fees.some((fee) => getEnrollmentId(fee) === selectedEnrollmentId)) {
      setSelectedEnrollmentId(getEnrollmentId(fees[0]))
    }
  }, [fees, selectedEnrollmentId])

  const addPayment = useMutation({
    mutationFn: ({ enrollmentId, values }: { enrollmentId: string; values: PaymentValues }) =>
      api.post(`/fees/${enrollmentId}/payments`, values),
    onSuccess: () => {
      toast.success("Payment recorded")
      queryClient.invalidateQueries({ queryKey: ["student-fees", studentId] })
      queryClient.invalidateQueries({ queryKey: ["fees-summary"] })
      setPaymentDialogFeeId(null)
      resetPayment()
    },
    onError: (err) => {
      toast.error(err instanceof ApiRequestError ? err.message : "Failed to record payment")
    },
  })

  const addStudentPayment = useMutation({
    mutationFn: ({ enrollmentId, values }: { enrollmentId: string; values: Omit<StudentFeePaymentValues, "enrollmentId"> }) =>
      api.post(`/fees/${enrollmentId}/payments`, values),
    onSuccess: () => {
      toast.success("Payment recorded")
      queryClient.invalidateQueries({ queryKey: ["student-fees", studentId] })
      queryClient.invalidateQueries({ queryKey: ["fees-summary"] })
      resetFeePayment({
        enrollmentId: selectedEnrollmentId,
        amount: undefined,
        mode: "offline",
        note: "",
        receiptNo: "",
      })
    },
    onError: (err) => {
      toast.error(err instanceof ApiRequestError ? err.message : "Failed to record payment")
    },
  })

  const { data: certificates } = useQuery({
    queryKey: ["student-certificates", studentId],
    queryFn: () => api.get<StudentCertificateRow[]>(`/certificates/student/${studentId}`),
    enabled: Boolean(studentId) && tab === "certificates" && canViewCertificates,
  })

  const {
    register: registerCertificate,
    handleSubmit: handleCertificateSubmit,
    reset: resetCertificate,
    formState: { isSubmitting: isSubmittingCertificate },
  } = useForm<CertificateInput, unknown, CertificateValues>({
    resolver: zodResolver(certificateSchema),
    defaultValues: { completionDate: "", issuerName: "" },
  })

  const generateCertificate = useMutation({
    mutationFn: ({ enrollmentId, values }: { enrollmentId: string; values: CertificateValues }) =>
      api.post("/certificates", {
        enrollment: enrollmentId,
        completionDate: values.completionDate || null,
        issuerName: values.issuerName,
      }),
    onSuccess: () => {
      toast.success("Certificate generated")
      queryClient.invalidateQueries({ queryKey: ["student-certificates", studentId] })
      setCertDialogEnrollmentId(null)
      resetCertificate()
    },
    onError: (err) => {
      toast.error(err instanceof ApiRequestError ? err.message : "Failed to generate certificate")
    },
  })

  const { control, register, handleSubmit, reset } = useForm<EnrollInput, unknown, EnrollValues>({
    resolver: zodResolver(enrollSchema),
    defaultValues: { course: "", batch: "" },
  })

  const enroll = useMutation({
    mutationFn: (values: EnrollValues) =>
      api.post("/enrollments", { student: studentId, course: values.course, batch: values.batch }),
    onSuccess: () => {
      toast.success("Student enrolled")
      queryClient.invalidateQueries({ queryKey: ["student", studentId] })
      setEnrollOpen(false)
      reset()
    },
    onError: (err) => {
      toast.error(err instanceof ApiRequestError ? err.message : "Failed to enroll student")
    },
  })

  if (!studentId) return <p className="text-sm text-muted-foreground">Invalid student link.</p>
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (!student) return <p className="text-sm text-muted-foreground">Student not found.</p>

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          to="/students"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Back to students
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            {student.firstName} {student.lastName}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Email" value={student.email} />
          <Field label="Phone" value={student.phone} />
          <Field label="Guardian contact" value={student.guardianContact} />
          <Field label="Date of birth" value={student.dob ? student.dob.slice(0, 10) : ""} />
          <Field label="Gender" value={student.gender} />
          <Field label="Address" value={student.address} />
        </CardContent>
      </Card>

      <div className="flex gap-1 border-b border-border">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-3 py-2 text-sm font-medium transition-colors",
              tab === t.id
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "courses" && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Enrolled courses</CardTitle>
            {canManageStudents && (
              <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
                <DialogTrigger
                  render={
                    <Button size="sm">
                      <Plus className="size-4" /> Enroll in course
                    </Button>
                  }
                />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Enroll in course</DialogTitle>
                    <DialogDescription>
                      Register {student.firstName} into an active course.
                    </DialogDescription>
                  </DialogHeader>
                  <form
                    className="flex flex-col gap-4"
                    onSubmit={handleSubmit((values) => enroll.mutate(values))}
                    noValidate
                  >
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="course">Course</Label>
                      <Controller
                        control={control}
                        name="course"
                        render={({ field }) => (
                          <select
                            id="course"
                            className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                            value={field.value}
                            onChange={field.onChange}
                          >
                            <option value="">Select a course…</option>
                            {activeCourses?.items.map((c) => {
                              const courseId = getCourseId(c)
                              return (
                                <option key={courseId || c.title} value={courseId} disabled={!courseId}>
                                  {c.title}
                                </option>
                              )
                            })}
                          </select>
                        )}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="batch">Batch (optional)</Label>
                      <input
                        id="batch"
                        className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                        {...register("batch")}
                      />
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={enroll.isPending}>
                        {enroll.isPending ? "Enrolling…" : "Enroll"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent>
            {!student.enrollments?.length ? (
              <p className="text-sm text-muted-foreground">Not enrolled in any courses yet.</p>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {student.enrollments.map((e) => {
                  const course = typeof e.course === "object" ? e.course : null
                  return (
                    <div key={e.id} className="flex items-center justify-between py-2.5 text-sm">
                      <div>
                        <p className="font-medium">{course?.title ?? "Unknown course"}</p>
                        {e.batch && <p className="text-xs text-muted-foreground">Batch: {e.batch}</p>}
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                          e.status === "ongoing" && "bg-primary/10 text-primary",
                          e.status === "completed" && "bg-muted text-muted-foreground",
                          e.status === "dropped" && "bg-destructive/10 text-destructive"
                        )}
                      >
                        {e.status}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "attendance" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            {!attendance?.records.length ? (
              <p className="text-sm text-muted-foreground">No attendance records yet.</p>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <SummaryStat label="Attendance" value={`${attendance.summary.percentage}%`} />
                  <SummaryStat label="Present" value={attendance.summary.present} />
                  <SummaryStat label="Late" value={attendance.summary.late} />
                  <SummaryStat label="Absent" value={attendance.summary.absent} />
                </div>
                <div className="flex flex-col divide-y divide-border">
                  {attendance.records.map((r) => {
                    const enrollment = typeof r.enrollment === "object" ? r.enrollment : null
                    const course = enrollment?.course as EnrollmentCourseRef | undefined
                    return (
                      <div key={r.id} className="flex items-center justify-between py-2 text-sm">
                        <div>
                          <p className="font-medium">{r.date.slice(0, 10)}</p>
                          {course && <p className="text-xs text-muted-foreground">{course.title}</p>}
                        </div>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                            r.status === "present" && "bg-primary/10 text-primary",
                            r.status === "late" && "bg-amber-500/10 text-amber-600",
                            r.status === "absent" && "bg-destructive/10 text-destructive"
                          )}
                        >
                          {r.status}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "fees" && canManageFees && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <SummaryStat label="Total fees" value={formatCurrency(feeSummary.totalFee)} />
            <SummaryStat label="Paid" value={formatCurrency(feeSummary.amountPaid)} />
            <SummaryStat label="Remaining" value={formatCurrency(feeSummary.amountRemaining)} />
            <SummaryStat label="Payments" value={feeSummary.paymentCount} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add fee payment</CardTitle>
            </CardHeader>
            <CardContent>
              {!fees?.length ? (
                <p className="text-sm text-muted-foreground">Enroll the student in a course first.</p>
              ) : (
                <form
                  className="grid grid-cols-1 gap-4 md:grid-cols-2"
                  onSubmit={handleFeePaymentSubmit((values) =>
                    addStudentPayment.mutate({
                      enrollmentId: values.enrollmentId,
                      values: {
                        amount: values.amount,
                        mode: values.mode,
                        note: values.note,
                        receiptNo: values.receiptNo,
                      },
                    })
                  )}
                  noValidate
                >
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <Label htmlFor="enrollmentId">Course fee</Label>
                    <select
                      id="enrollmentId"
                      key={selectedEnrollmentId || "empty"}
                      className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                      defaultValue={selectedEnrollmentId}
                      {...registerFeePayment("enrollmentId", {
                        onChange: (event) => setSelectedEnrollmentId(event.target.value),
                      })}
                    >
                      <option value="">Select a course…</option>
                      {fees.map((fee) => {
                        const enrollment = typeof fee.enrollment === "object" ? fee.enrollment : null
                        const course = enrollment?.course as EnrollmentCourseRef | undefined
                        const enrollmentId = getEnrollmentId(fee)
                        return (
                          <option key={fee.id} value={enrollmentId}>
                            {course?.title ?? "Course"} - Remaining {formatCurrency(fee.amountRemaining)}
                          </option>
                        )
                      })}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="feeAmount">Amount</Label>
                    <input
                      id="feeAmount"
                      type="number"
                      step="0.01"
                      className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                      {...registerFeePayment("amount")}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="feeMode">Payment type</Label>
                    <select
                      id="feeMode"
                      className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                      {...registerFeePayment("mode")}
                    >
                      <option value="offline">Offline</option>
                      <option value="online">Online</option>
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="card">Card</option>
                      <option value="bank_transfer">Bank transfer</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="feeReceiptNo">Receipt no.</Label>
                    <input
                      id="feeReceiptNo"
                      className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                      {...registerFeePayment("receiptNo")}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <Label htmlFor="feeNote">Note (optional)</Label>
                    <input
                      id="feeNote"
                      className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                      {...registerFeePayment("note")}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Button type="submit" disabled={isSubmittingFeePayment || addStudentPayment.isPending}>
                      {addStudentPayment.isPending ? "Saving…" : "Add payment"}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          {!fees?.length ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No fee records yet — enroll this student in a course to create one.
              </CardContent>
            </Card>
          ) : (
            fees.map((fee) => {
              const enrollment = typeof fee.enrollment === "object" ? fee.enrollment : null
              const course = enrollment?.course as EnrollmentCourseRef | undefined
              const enrollmentId = (enrollment as Enrollment | null)?.id
              return (
                <Card key={fee.id}>
                  <CardHeader className="flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{course?.title ?? "Course"}</CardTitle>
                      {fee.dueDate && (
                        <p className="text-xs text-muted-foreground">Due {fee.dueDate.slice(0, 10)}</p>
                      )}
                    </div>
                    {enrollmentId && (
                      <Dialog
                        open={paymentDialogFeeId === fee.id}
                        onOpenChange={(open) => setPaymentDialogFeeId(open ? fee.id : null)}
                      >
                        <DialogTrigger render={<Button size="sm">Add payment</Button>} />
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Record payment</DialogTitle>
                            <DialogDescription>
                              Remaining balance: {formatCurrency(fee.amountRemaining)}
                            </DialogDescription>
                          </DialogHeader>
                          <form
                            className="flex flex-col gap-4"
                            onSubmit={handlePaymentSubmit((values) =>
                              addPayment.mutate({ enrollmentId, values })
                            )}
                            noValidate
                          >
                            <div className="flex flex-col gap-1.5">
                              <Label htmlFor="amount">Amount</Label>
                              <input
                                id="amount"
                                type="number"
                                step="0.01"
                                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                                {...registerPayment("amount")}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="flex flex-col gap-1.5">
                                <Label htmlFor="mode">Payment mode</Label>
                                <select
                                  id="mode"
                                  className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                                  {...registerPayment("mode")}
                                >
                                  <option value="cash">Cash</option>
                                  <option value="upi">UPI</option>
                                  <option value="card">Card</option>
                                  <option value="bank_transfer">Bank transfer</option>
                                  <option value="other">Other</option>
                                </select>
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <Label htmlFor="receiptNo">Receipt no.</Label>
                                <input
                                  id="receiptNo"
                                  className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                                  {...registerPayment("receiptNo")}
                                />
                              </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <Label htmlFor="note">Note (optional)</Label>
                              <input
                                id="note"
                                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                                {...registerPayment("note")}
                              />
                            </div>
                            <DialogFooter>
                              <Button type="submit" disabled={isSubmittingPayment || addPayment.isPending}>
                                {addPayment.isPending ? "Saving…" : "Record payment"}
                              </Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>
                    )}
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <SummaryStat label="Total fee" value={formatCurrency(fee.totalFee)} />
                      <SummaryStat label="Paid" value={formatCurrency(fee.amountPaid)} />
                      <SummaryStat label="Remaining" value={formatCurrency(fee.amountRemaining)} />
                    </div>
                    {fee.payments.length > 0 && (
                      <div className="flex flex-col divide-y divide-border">
                        {fee.payments
                          .slice()
                          .reverse()
                          .map((p) => (
                            <div key={p.id} className="flex items-center justify-between py-2 text-sm">
                              <div>
                                <p className="font-medium">{formatCurrency(p.amount)}</p>
                                <p className="text-xs text-muted-foreground capitalize">
                                    {p.date.slice(0, 10)} · {formatPaymentMode(p.mode)}
                                  {p.receiptNo && ` · #${p.receiptNo}`}
                                </p>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      )}

      {tab === "fees" && !canManageFees && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Fee details are only visible to the Owner.
          </CardContent>
        </Card>
      )}

      {tab === "certificates" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Certificates</CardTitle>
          </CardHeader>
          <CardContent>
            {!certificates?.length ? (
              <p className="text-sm text-muted-foreground">
                Not enrolled in any courses yet — certificates apply to a course enrollment.
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {certificates.map((row) => (
                  <div
                    key={row.enrollment}
                    className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium">{row.courseName}</p>
                      {row.certificate ? (
                        <p className="text-xs text-muted-foreground">
                          {row.certificate.credentialId} · issued{" "}
                          {row.certificate.issueDate.slice(0, 10)}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground capitalize">
                          {row.enrollmentStatus} · not yet certified
                        </p>
                      )}
                    </div>
                    {row.certificate ? (
                      <Button
                        variant="outline"
                        size="sm"
                        render={
                          <a
                            href={`${API_URL}/certificates/${row.certificate.credentialId}/download`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Download className="size-3.5" /> Download PDF
                          </a>
                        }
                      />
                    ) : (
                      canGenerateCertificates &&
                      row.enrollmentStatus !== "dropped" && (
                        <Dialog
                          open={certDialogEnrollmentId === row.enrollment}
                          onOpenChange={(open) =>
                            setCertDialogEnrollmentId(open ? row.enrollment : null)
                          }
                        >
                          <DialogTrigger
                            render={
                              <Button size="sm">
                                <Award className="size-3.5" /> Generate certificate
                              </Button>
                            }
                          />
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Generate certificate</DialogTitle>
                              <DialogDescription>
                                Issue a certificate for {row.courseName}. This creates a permanent
                                credential ID.
                              </DialogDescription>
                            </DialogHeader>
                            <form
                              className="flex flex-col gap-4"
                              onSubmit={handleCertificateSubmit((values) =>
                                generateCertificate.mutate({ enrollmentId: row.enrollment, values })
                              )}
                              noValidate
                            >
                              <div className="flex flex-col gap-1.5">
                                <Label htmlFor="completionDate">Completion date (optional)</Label>
                                <input
                                  id="completionDate"
                                  type="date"
                                  className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                                  {...registerCertificate("completionDate")}
                                />
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <Label htmlFor="issuerName">Issuer name (optional)</Label>
                                <input
                                  id="issuerName"
                                  placeholder="Defaults to the centre name"
                                  className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                                  {...registerCertificate("issuerName")}
                                />
                              </div>
                              <DialogFooter>
                                <Button
                                  type="submit"
                                  disabled={isSubmittingCertificate || generateCertificate.isPending}
                                >
                                  {generateCertificate.isPending ? "Generating…" : "Generate"}
                                </Button>
                              </DialogFooter>
                            </form>
                          </DialogContent>
                        </Dialog>
                      )
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab !== "courses" && tab !== "attendance" && tab !== "fees" && tab !== "certificates" && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {tabs.find((t) => t.id === tab)?.label} will show up here once that module is built.
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function SummaryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  )
}
