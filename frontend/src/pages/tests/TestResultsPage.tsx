import * as React from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { ClipboardList, RefreshCw, CheckCircle2, XCircle, MinusCircle, ArrowLeft } from "lucide-react"
import { api } from "#lib/api-client"
import { testsApi } from "#lib/tests-api"
import { errorMessage, formatDateTime, personName, refTitle } from "#lib/test-utils"
import type { Course, PaginatedResult, Test, TestAttempt } from "#lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#components/ui/card"
import { Button } from "#components/ui/button"
import { Pagination } from "#components/ui/pagination"
import { useClampPage, usePage } from "#lib/use-pagination"

const selectClass = "flex h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
const PAGE_SIZE = 10

export default function TestResultsPage() {
  const [filters, setFilters] = React.useState({ test: "", course: "", student: "", status: "", passed: "" })
  const [selectedAttemptId, setSelectedAttemptId] = React.useState("")

  const testsQuery = useQuery({ queryKey: ["tests-results-tests"], queryFn: () => api.get<PaginatedResult<Test>>("/tests?limit=100") })
  const coursesQuery = useQuery({ queryKey: ["tests-results-courses"], queryFn: () => api.get<PaginatedResult<Course>>("/courses?limit=100") })
  const studentsQuery = useQuery({ queryKey: ["tests-results-students"], queryFn: () => testsApi.studentLookup() })

  const [page, setPageState] = usePage(Object.values(filters).join("|"))
  const setPage = (next: number) => {
    setPageState(next)
    setSelectedAttemptId("")
  }

  const params = new URLSearchParams()
  if (filters.test) params.set("test", filters.test)
  if (filters.course) params.set("course", filters.course)
  if (filters.student) params.set("student", filters.student)
  if (filters.status) params.set("status", filters.status)
  if (filters.passed) params.set("passed", filters.passed)
  params.set("page", String(page))
  params.set("limit", String(PAGE_SIZE))

  const attemptsQuery = useQuery({
    queryKey: ["tests-attempts", filters, page],
    queryFn: () => testsApi.listAttempts(`?${params.toString()}`),
    placeholderData: keepPreviousData,
  })
  useClampPage(page, attemptsQuery.data?.totalPages, setPageState, !attemptsQuery.isPlaceholderData)

  const selectedAttemptQuery = useQuery({
    queryKey: ["tests-attempt", selectedAttemptId],
    queryFn: () => testsApi.getAttempt(selectedAttemptId),
    enabled: Boolean(selectedAttemptId),
  })

  const setFilter = (key: keyof typeof filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }))
    setSelectedAttemptId("")
  }

  const items: TestAttempt[] = attemptsQuery.data?.items ?? []
  const detail = selectedAttemptQuery.data

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to="/tests" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5" /> Back to tests
          </Link>
          <h1 className="text-2xl font-semibold">Results</h1>
          <p className="text-sm text-muted-foreground">Review submitted attempts and per-question marks.</p>
        </div>
        <Button variant="outline" onClick={() => attemptsQuery.refetch()} disabled={attemptsQuery.isFetching}>
          <RefreshCw className={`size-4 ${attemptsQuery.isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <select className={selectClass} value={filters.test} onChange={(e) => setFilter("test", e.target.value)}>
          <option value="">All tests</option>
          {testsQuery.data?.items.map((test) => <option key={test.id} value={test.id}>{test.title}</option>)}
        </select>
        <select className={selectClass} value={filters.course} onChange={(e) => setFilter("course", e.target.value)}>
          <option value="">All courses</option>
          {coursesQuery.data?.items.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
        </select>
        <select className={selectClass} value={filters.student} onChange={(e) => setFilter("student", e.target.value)}>
          <option value="">All students</option>
          {studentsQuery.data?.map((student) => <option key={student.id} value={student.id}>{student.firstName} {student.lastName}</option>)}
        </select>
        <select className={selectClass} value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
          <option value="">All statuses</option>
          <option value="in_progress">in progress</option>
          <option value="submitted">submitted</option>
          <option value="auto_submitted">auto-submitted</option>
          <option value="expired">expired</option>
        </select>
        <select className={selectClass} value={filters.passed} onChange={(e) => setFilter("passed", e.target.value)}>
          <option value="">Pass / fail</option>
          <option value="true">Passed</option>
          <option value="false">Failed</option>
        </select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><ClipboardList className="size-4" /> Attempts</CardTitle>
          <CardDescription>{attemptsQuery.isLoading ? "Loading…" : `${attemptsQuery.data?.total ?? 0} result(s)`}</CardDescription>
        </CardHeader>
        <CardContent>
          {attemptsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : attemptsQuery.isError ? (
            <p className="text-sm text-destructive">{errorMessage(attemptsQuery.error, "Unable to load attempts")}</p>
          ) : attemptsQuery.data?.total === 0 ? (
            <p className="text-sm text-muted-foreground">No attempts found.</p>
          ) : !items.length ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
              <div className="flex flex-col gap-2">
              <div className="flex max-h-[70vh] flex-col divide-y divide-border overflow-auto rounded-xl border border-border">
                {items.map((attempt) => (
                  <button
                    key={attempt.id}
                    type="button"
                    onClick={() => setSelectedAttemptId(attempt.id)}
                    className={`flex flex-col gap-1 px-3 py-3 text-left text-sm hover:bg-muted ${selectedAttemptId === attempt.id ? "bg-muted" : ""}`}
                  >
                    <span className="font-medium">{personName(attempt.student)} · attempt #{attempt.attemptNumber}</span>
                    <span className="text-xs text-muted-foreground">{refTitle(attempt.test, "Deleted test")} · {formatDateTime(attempt.submittedAt ?? attempt.startedAt)}</span>
                    <span className="text-xs text-muted-foreground">
                      {attempt.status.replace("_", " ")}
                      {attempt.result ? ` · ${attempt.result.score}/${attempt.result.totalMarks} (${attempt.result.percentage}%) · ${attempt.result.passed ? "passed" : "failed"}` : " · in progress"}
                    </span>
                  </button>
                ))}
              </div>
              {attemptsQuery.data && (
                <Pagination
                  page={attemptsQuery.data.page}
                  totalPages={attemptsQuery.data.totalPages}
                  total={attemptsQuery.data.total}
                  limit={attemptsQuery.data.limit}
                  onPageChange={setPage}
                  isFetching={attemptsQuery.isFetching}
                />
              )}
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
                  ) : !detail ? (
                    <p className="text-muted-foreground">Attempt not found.</p>
                  ) : !detail.result ? (
                    <p className="text-muted-foreground">This attempt has not been submitted yet.</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Score</p><p className="text-base font-semibold">{detail.result.score} / {detail.result.totalMarks}</p></div>
                        <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Percentage</p><p className="text-base font-semibold">{detail.result.percentage}%</p></div>
                        <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Correct</p><p className="text-base font-semibold text-emerald-500">{detail.result.correctCount}</p></div>
                        <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Wrong / partial / skipped</p><p className="text-base font-semibold">{detail.result.wrongCount} / {detail.result.partiallyCorrectCount} / {detail.result.unansweredCount}</p></div>
                      </div>
                      <p className="text-xs text-muted-foreground">Time taken: {Math.round(detail.result.timeTakenSeconds / 60)} min · {detail.result.submissionMode === "auto" ? "auto-submitted" : "submitted by student"}</p>
                      <div className="max-h-[50vh] space-y-2 overflow-auto">
                        <p className="font-medium">Question results</p>
                        {detail.result.questionResults.map((result, i) => {
                          const question = detail.testSnapshot.questions.find((q) => String(q.questionId) === String(result.questionId))
                          const Icon = result.isCorrect ? CheckCircle2 : result.isUnanswered ? MinusCircle : XCircle
                          const tone = result.isCorrect ? "text-emerald-500" : result.isUnanswered ? "text-muted-foreground" : "text-rose-500"
                          return (
                            <div key={result.questionId} className="rounded-lg border border-border p-3">
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-sm font-medium">{i + 1}. {question?.snapshot.text ?? "Question removed"}</p>
                                <Icon className={`size-4 shrink-0 ${tone}`} />
                              </div>
                              <ul className="mt-2 space-y-1 text-xs">
                                {question?.snapshot.options.map((option) => {
                                  const chosen = result.selectedOptionIds.includes(option.id)
                                  const correct = result.correctOptionIds.includes(option.id)
                                  return (
                                    <li key={option.id} className={correct ? "text-emerald-500" : chosen ? "text-rose-500" : "text-muted-foreground"}>
                                      {correct ? "✓" : chosen ? "✗" : "•"} {option.text}
                                      {chosen && " (student's answer)"}
                                    </li>
                                  )
                                })}
                              </ul>
                              <p className="mt-2 text-xs text-muted-foreground">Awarded {result.marksAwarded} / {result.maxMarks} marks</p>
                            </div>
                          )
                        })}
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
