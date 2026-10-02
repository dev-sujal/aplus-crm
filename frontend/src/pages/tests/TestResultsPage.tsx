import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { ClipboardList, Filter, CheckCircle2, XCircle, ArrowLeft } from "lucide-react"
import { api } from "#lib/api-client"
import { testsApi } from "#lib/tests-api"
import type { Course, PaginatedResult, Student, Test, TestAttempt } from "#lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#components/ui/card"
import { Button } from "#components/ui/button"

export default function TestResultsPage() {
  const [filters, setFilters] = React.useState({ test: "", course: "", student: "", status: "", passed: "" })
  const [selectedAttemptId, setSelectedAttemptId] = React.useState("")

  const testsQuery = useQuery({ queryKey: ["tests-results-tests"], queryFn: () => api.get<PaginatedResult<Test>>("/tests?limit=100") })
  const coursesQuery = useQuery({ queryKey: ["tests-results-courses"], queryFn: () => api.get<PaginatedResult<Course>>("/courses?limit=100") })
  const studentsQuery = useQuery({ queryKey: ["tests-results-students"], queryFn: () => api.get<PaginatedResult<Student>>("/students?limit=200") })

  const params = new URLSearchParams()
  if (filters.test) params.set("test", filters.test)
  if (filters.course) params.set("course", filters.course)
  if (filters.student) params.set("student", filters.student)
  if (filters.status) params.set("status", filters.status)
  if (filters.passed) params.set("passed", filters.passed)
  params.set("limit", "50")

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["tests-attempts", filters],
    queryFn: () => testsApi.listAttempts(`?${params.toString()}`),
  })

  const selectedAttemptQuery = useQuery({
    queryKey: ["tests-attempt", selectedAttemptId],
    queryFn: () => testsApi.getAttempt(selectedAttemptId),
    enabled: Boolean(selectedAttemptId),
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            to="/tests"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Back to tests
          </Link>
          <h1 className="text-2xl font-semibold">Results</h1>
          <p className="text-sm text-muted-foreground">Review submitted attempts and per-question marks.</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}><Filter className="size-4" /> Refresh</Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <select className="flex h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" value={filters.test} onChange={(e) => setFilters((current) => ({ ...current, test: e.target.value }))}>
          <option value="">All tests</option>
          {testsQuery.data?.items.map((test) => <option key={test.id} value={test.id}>{test.title}</option>)}
        </select>
        <select className="flex h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" value={filters.course} onChange={(e) => setFilters((current) => ({ ...current, course: e.target.value }))}>
          <option value="">All courses</option>
          {coursesQuery.data?.items.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
        </select>
        <select className="flex h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" value={filters.student} onChange={(e) => setFilters((current) => ({ ...current, student: e.target.value }))}>
          <option value="">All students</option>
          {studentsQuery.data?.items.map((student) => <option key={student.id} value={student.id}>{student.firstName} {student.lastName}</option>)}
        </select>
        <select className="flex h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" value={filters.status} onChange={(e) => setFilters((current) => ({ ...current, status: e.target.value }))}>
          <option value="">All statuses</option>
          <option value="in_progress">in_progress</option>
          <option value="submitted">submitted</option>
          <option value="auto_submitted">auto_submitted</option>
          <option value="expired">expired</option>
        </select>
        <select className="flex h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" value={filters.passed} onChange={(e) => setFilters((current) => ({ ...current, passed: e.target.value }))}>
          <option value="">Pass filter</option>
          <option value="true">Passed</option>
          <option value="false">Failed</option>
        </select>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><ClipboardList className="size-4" /> Attempts</CardTitle>
          <CardDescription>{isLoading ? "Loading…" : `${(data as PaginatedResult<TestAttempt> | undefined)?.total ?? 0} result(s)`}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !data?.items.length ? (
            <p className="text-sm text-muted-foreground">No attempts yet.</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
                {data.items.map((attempt) => (
                  <button key={attempt.id} type="button" onClick={() => setSelectedAttemptId(attempt.id)} className={`flex flex-col gap-1 px-3 py-3 text-left text-sm hover:bg-muted ${selectedAttemptId === attempt.id ? "bg-muted" : ""}`}>
                    <span className="font-medium">Attempt #{attempt.attemptNumber}</span>
                    <span className="text-xs text-muted-foreground">{typeof attempt.test === "string" ? attempt.test : attempt.test.title} · {typeof attempt.student === "string" ? attempt.student : `${attempt.student.firstName} ${attempt.student.lastName}`}</span>
                    <span className="text-xs text-muted-foreground">{attempt.status} · {attempt.result?.percentage ?? 0}%</span>
                  </button>
                ))}
              </div>
              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle className="text-base">Attempt details</CardTitle>
                  <CardDescription>{selectedAttemptId ? "Detailed scoring" : "Select an attempt to inspect the score breakdown."}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {!selectedAttemptId ? (
                    <p className="text-muted-foreground">No attempt selected.</p>
                  ) : selectedAttemptQuery.isLoading ? (
                    <p className="text-muted-foreground">Loading attempt…</p>
                  ) : !selectedAttemptQuery.data ? (
                    <p className="text-muted-foreground">Attempt not found.</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Score</p><p className="text-base font-semibold">{selectedAttemptQuery.data.result?.score ?? 0} / {selectedAttemptQuery.data.result?.totalMarks ?? 0}</p></div>
                        <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Percentage</p><p className="text-base font-semibold">{selectedAttemptQuery.data.result?.percentage ?? 0}%</p></div>
                        <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Correct</p><p className="text-base font-semibold text-emerald-500">{selectedAttemptQuery.data.result?.correctCount ?? 0}</p></div>
                        <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Wrong</p><p className="text-base font-semibold text-rose-500">{selectedAttemptQuery.data.result?.wrongCount ?? 0}</p></div>
                      </div>
                      <div className="space-y-2">
                        <p className="font-medium">Question results</p>
                        {selectedAttemptQuery.data.result?.questionResults.map((result) => (
                          <div key={result.questionId} className="rounded-lg border border-border p-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium">{result.questionId}</p>
                              {result.isCorrect ? <CheckCircle2 className="size-4 text-emerald-500" /> : <XCircle className="size-4 text-rose-500" />}
                            </div>
                            <p className="text-xs text-muted-foreground">Awarded {result.marksAwarded} / {result.maxMarks} marks</p>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}