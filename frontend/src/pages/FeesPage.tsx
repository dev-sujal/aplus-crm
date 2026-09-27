import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { api } from "#lib/api-client"
import type { EnrollmentCourseRef, EnrollmentStudentRef, FeeSummary } from "#lib/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "#components/ui/card"

function formatCurrency(n: number) {
  return `₹${n.toLocaleString("en-IN")}`
}

function formatPaymentMode(mode: string) {
  if (mode === "online") return "Online"
  if (mode === "offline") return "Offline"
  return mode.replace(/_/g, " ")
}

function getStudentId(student: EnrollmentStudentRef): string {
  const fallbackId = (student as unknown as { _id?: string })._id
  return student.id || fallbackId || ""
}

export default function FeesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["fees-summary"],
    queryFn: () => api.get<FeeSummary>("/fees/summary"),
  })

  const recentPayments = data?.recentPayments ?? []

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Fees</h1>
        <p className="text-sm text-muted-foreground">
          Collections overview across all courses. Open a student's profile to record a payment.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Total collected</CardDescription>
            <CardTitle className="text-2xl">
              {isLoading ? "…" : formatCurrency(data?.totalCollected ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Total pending</CardDescription>
            <CardTitle className="text-2xl">
              {isLoading ? "…" : formatCurrency(data?.totalPending ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Overdue students</CardDescription>
            <CardTitle className="text-2xl">{isLoading ? "…" : (data?.overdueCount ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Overdue</CardTitle>
          <CardDescription>Past due date with a balance remaining.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !data?.overdue.length ? (
            <p className="text-sm text-muted-foreground">Nothing overdue right now.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {data.overdue.map((fee) => {
                const enrollment = typeof fee.enrollment === "object" ? fee.enrollment : null
                const student = enrollment?.student as EnrollmentStudentRef | undefined
                const course = enrollment?.course as EnrollmentCourseRef | undefined
                const studentId = student ? getStudentId(student) : ""
                return (
                  <div
                    key={fee.id}
                    className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {student && studentId ? (
                          <Link to={`/students/${studentId}`} className="hover:underline">
                            {student.firstName} {student.lastName}
                          </Link>
                        ) : (
                          "Unknown student"
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {course?.title ?? "Unknown course"}
                        {fee.dueDate && ` · Due ${fee.dueDate.slice(0, 10)}`}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-destructive">
                      {formatCurrency(fee.amountRemaining)} due
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent payments</CardTitle>
          <CardDescription>Latest fees collected across all students.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !recentPayments.length ? (
            <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {recentPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {payment.studentName ? (
                        <Link to={`/students/${payment.studentId}`} className="hover:underline">
                          {payment.studentName}
                        </Link>
                      ) : (
                        "Unknown student"
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {payment.courseName || "Unknown course"} · {payment.date.slice(0, 10)} · {formatPaymentMode(payment.mode)}
                      {payment.receiptNo && ` · #${payment.receiptNo}`}
                    </p>
                    {payment.note && <p className="text-xs text-muted-foreground">{payment.note}</p>}
                  </div>
                  <span className="text-sm font-medium">{formatCurrency(payment.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
