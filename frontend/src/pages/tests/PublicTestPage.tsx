import * as React from "react"
import { useParams } from "react-router-dom"
import { useMutation, useQuery } from "@tanstack/react-query"
import { CheckCircle2, ChevronLeft, ChevronRight, Clock3, Flag, Loader2, Send, XCircle } from "lucide-react"
import { toast } from "sonner"
import { testsApi } from "#lib/tests-api"
import { errorMessage, formatDateTime } from "#lib/test-utils"
import type { PublicAttemptResultResponse, PublicAttemptStartResponse, TestAttemptResult } from "#lib/types"
import { Button } from "#components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#components/ui/card"

type AnswerMap = Record<string, { selectedOptionIds: string[]; markedForReview: boolean }>

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(2, "0")
  const ss = String(s).padStart(2, "0")
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

function ResultSummary({ result }: { result: TestAttemptResult }) {
  return (
    <div className="space-y-3 text-sm">
      <p className="flex items-center gap-2 text-base font-medium">
        {result.passed ? <CheckCircle2 className="size-5 text-emerald-500" /> : <XCircle className="size-5 text-rose-500" />}
        {result.passed ? "Passed" : "Not passed"}
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Score</p><p className="font-semibold">{result.score} / {result.totalMarks}</p></div>
        <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Percentage</p><p className="font-semibold">{result.percentage}%</p></div>
        <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Correct</p><p className="font-semibold text-emerald-500">{result.correctCount}</p></div>
        <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Unanswered</p><p className="font-semibold">{result.unansweredCount}</p></div>
      </div>
    </div>
  )
}

export default function PublicTestPage() {
  const { shareToken = "" } = useParams<{ shareToken: string }>()

  const assignmentQuery = useQuery({
    queryKey: ["public-test", shareToken],
    queryFn: () => testsApi.publicAssignment(shareToken),
    enabled: Boolean(shareToken),
    retry: false,
  })

  const [attempt, setAttempt] = React.useState<PublicAttemptStartResponse | null>(null)
  const [answers, setAnswers] = React.useState<AnswerMap>({})
  const [index, setIndex] = React.useState(0)
  const [outcome, setOutcome] = React.useState<PublicAttemptResultResponse | null>(null)
  const [now, setNow] = React.useState(() => Date.now())
  const dirty = React.useRef(false)
  const submitting = React.useRef(false)

  const previousResult = useQuery({
    queryKey: ["public-test-result", shareToken],
    queryFn: () => testsApi.publicResult(shareToken),
    enabled: assignmentQuery.data?.status === "submitted" && !attempt && !outcome,
    retry: false,
  })

  const questions = React.useMemo(() => attempt?.test.questions ?? [], [attempt])

  const buildAnswers = React.useCallback(
    () =>
      questions.map((question) => ({
        questionId: question.questionId,
        selectedOptionIds: answers[question.questionId]?.selectedOptionIds ?? [],
        markedForReview: answers[question.questionId]?.markedForReview ?? false,
      })),
    [questions, answers]
  )

  const startAttempt = useMutation({
    mutationFn: () => testsApi.startPublicAttempt(shareToken),
    onSuccess: (data) => {
      setAttempt(data)
      setOutcome(null)
      setAnswers(
        Object.fromEntries(
          data.answers.map((a) => [a.questionId, { selectedOptionIds: a.selectedOptionIds, markedForReview: a.markedForReview }])
        )
      )
      setIndex(data.currentQuestionIndex ?? 0)
      dirty.current = false
    },
    onError: (error) => toast.error(errorMessage(error, "Unable to start test")),
  })

  const saveProgress = useMutation({
    mutationFn: () => testsApi.savePublicProgress(shareToken, { currentQuestionIndex: index, answers: buildAnswers() }),
    onSuccess: () => {
      dirty.current = false
    },
  })

  const submitAttempt = useMutation({
    mutationFn: () => testsApi.submitPublicAttempt(shareToken, { answers: buildAnswers() }) as Promise<PublicAttemptResultResponse>,
    onSuccess: (data) => {
      setOutcome(data)
      setAttempt(null)
    },
    onError: (error) => {
      submitting.current = false
      toast.error(errorMessage(error, "Unable to submit test"))
    },
  })

  const submitNow = React.useCallback(() => {
    if (submitting.current) return
    submitting.current = true
    submitAttempt.mutate()
  }, [submitAttempt])

  // countdown + auto-submit when time is up
  React.useEffect(() => {
    if (!attempt) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [attempt])

  const remainingMs = attempt ? new Date(attempt.expiresAt).getTime() - now : 0
  React.useEffect(() => {
    if (attempt && remainingMs <= 0) {
      toast.message("Time is up — submitting your answers")
      submitNow()
    }
  }, [attempt, remainingMs, submitNow])

  // autosave every 15s when something changed. The latest mutation object is
  // read through a ref so the interval is not recreated on every re-render
  // (the countdown re-renders once a second).
  const saveRef = React.useRef(saveProgress)
  React.useEffect(() => {
    saveRef.current = saveProgress
  })
  React.useEffect(() => {
    if (!attempt) return
    const timer = window.setInterval(() => {
      const save = saveRef.current
      if (dirty.current && !save.isPending && !submitting.current) save.mutate()
    }, 15000)
    return () => window.clearInterval(timer)
  }, [attempt])

  function selectOption(questionId: string, optionId: string, single: boolean) {
    dirty.current = true
    setAnswers((current) => {
      const prev = current[questionId]?.selectedOptionIds ?? []
      const next = single ? [optionId] : prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]
      return { ...current, [questionId]: { selectedOptionIds: next, markedForReview: current[questionId]?.markedForReview ?? false } }
    })
  }

  function toggleMark(questionId: string) {
    dirty.current = true
    setAnswers((current) => ({
      ...current,
      [questionId]: {
        selectedOptionIds: current[questionId]?.selectedOptionIds ?? [],
        markedForReview: !(current[questionId]?.markedForReview ?? false),
      },
    }))
  }

  function go(next: number) {
    setIndex(Math.min(Math.max(0, next), Math.max(0, questions.length - 1)))
    if (dirty.current && !saveProgress.isPending) saveProgress.mutate()
  }

  function confirmSubmit() {
    const unanswered = questions.filter((q) => !(answers[q.questionId]?.selectedOptionIds.length)).length
    const message = unanswered
      ? `You have ${unanswered} unanswered question(s). Submit anyway?`
      : "Submit your answers? You cannot change them afterwards."
    if (window.confirm(message)) submitNow()
  }

  const info = assignmentQuery.data

  // ---------- states without an active attempt ----------
  let body: React.ReactNode
  if (!shareToken) {
    body = <p className="text-sm text-muted-foreground">This test link is missing its token.</p>
  } else if (assignmentQuery.isLoading) {
    body = <div className="flex justify-center py-10"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
  } else if (assignmentQuery.isError || !info) {
    body = <p className="text-sm text-destructive">{errorMessage(assignmentQuery.error, "This test link is not valid.")}</p>
  } else if (outcome) {
    body = outcome.visible && outcome.result ? (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Your test has been submitted.</p>
        <ResultSummary result={outcome.result} />
      </div>
    ) : (
      <p className="text-sm">Your submission was received. Your teacher will share the results with you.</p>
    )
  } else if (attempt) {
    const active = questions[index]
    const current = active ? answers[active.questionId] : undefined
    const single = active?.snapshot.type === "single"
    const answeredCount = questions.filter((q) => answers[q.questionId]?.selectedOptionIds.length).length
    body = (
      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="space-y-4">
          <div className="rounded-xl border border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Question {index + 1} of {questions.length}</p>
              <div className={`flex items-center gap-2 text-sm font-medium ${remainingMs < 60000 ? "text-rose-500" : "text-muted-foreground"}`}>
                <Clock3 className="size-4" /> {formatRemaining(remainingMs)}
              </div>
            </div>
            {active && (
              <div className="mt-4 space-y-4">
                <p className="whitespace-pre-wrap text-base font-medium">{active.snapshot.text}</p>
                <p className="text-xs text-muted-foreground">
                  {single ? "Choose one answer" : "Choose all that apply"} · {active.snapshot.marks} mark(s)
                </p>
                <div className="space-y-2">
                  {active.snapshot.options.map((option) => {
                    const selected = current?.selectedOptionIds.includes(option.id) ?? false
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => selectOption(active.questionId, option.id, single)}
                        className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm ${selected ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}
                      >
                        <span className={`flex size-4 shrink-0 items-center justify-center border ${single ? "rounded-full" : "rounded-[4px]"} ${selected ? "border-primary bg-primary" : "border-input"}`}>
                          {selected && <span className={`size-1.5 bg-primary-foreground ${single ? "rounded-full" : "rounded-[1px]"}`} />}
                        </span>
                        <span>{option.text}</span>
                      </button>
                    )
                  })}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => go(index - 1)} disabled={index === 0}><ChevronLeft className="size-4" /> Previous</Button>
                  <Button variant="outline" onClick={() => go(index + 1)} disabled={index >= questions.length - 1}>Next <ChevronRight className="size-4" /></Button>
                  <Button variant="outline" onClick={() => toggleMark(active.questionId)}>
                    <Flag className={`size-4 ${current?.markedForReview ? "fill-current" : ""}`} /> {current?.markedForReview ? "Unmark" : "Mark for review"}
                  </Button>
                  <Button variant="outline" onClick={() => saveProgress.mutate()} disabled={saveProgress.isPending}>
                    {saveProgress.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Save
                  </Button>
                  <Button onClick={confirmSubmit} disabled={submitAttempt.isPending}>
                    {submitAttempt.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Submit
                  </Button>
                </div>
              </div>
            )}
          </div>
          {attempt.test.instructions && (
            <details className="rounded-xl border border-border p-4 text-sm">
              <summary className="cursor-pointer font-medium">Instructions</summary>
              <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{attempt.test.instructions}</p>
            </details>
          )}
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-border p-4 text-sm">
            <p className="font-medium">Progress</p>
            <p className="mt-2 text-muted-foreground">{answeredCount} of {questions.length} answered</p>
          </div>
          <div className="rounded-xl border border-border p-4 text-sm">
            <p className="font-medium">Questions</p>
            <div className="mt-3 grid grid-cols-5 gap-2">
              {questions.map((question, i) => {
                const a = answers[question.questionId]
                const answered = Boolean(a?.selectedOptionIds.length)
                return (
                  <button
                    key={question.questionId}
                    type="button"
                    onClick={() => go(i)}
                    className={`rounded-lg border px-2 py-1 text-xs ${i === index ? "border-primary ring-1 ring-primary" : "border-border"} ${answered ? "bg-primary/15" : ""} ${a?.markedForReview ? "border-amber-500" : ""}`}
                  >
                    {i + 1}
                  </button>
                )
              })}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Shaded = answered · amber border = marked for review</p>
          </div>
        </div>
      </div>
    )
  } else {
    const pr = previousResult.data
    body = (
      <div className="space-y-4 text-sm">
        {info.test.instructions && <p className="whitespace-pre-wrap text-muted-foreground">{info.test.instructions}</p>}
        <ul className="space-y-1 text-muted-foreground">
          <li>Questions: {info.test.questions.length}</li>
          <li>Time limit: {info.test.timeLimitMinutes} minutes (the timer starts when you press Start)</li>
          <li>Pass mark: {info.test.passPercentage}%</li>
          <li>Attempts allowed: {info.attemptsAllowed}</li>
          {(info.availabilityStart || info.availabilityEnd) && (
            <li>Available: {formatDateTime(info.availabilityStart)} → {formatDateTime(info.availabilityEnd)}</li>
          )}
        </ul>
        {info.status === "submitted" && (
          <div className="rounded-lg border border-border p-3">
            <p className="mb-2 font-medium">You have already submitted this test.</p>
            {pr?.visible && pr.result ? <ResultSummary result={pr.result} /> : pr && !pr.visible ? <p className="text-muted-foreground">Results are hidden for this test.</p> : null}
          </div>
        )}
        <Button onClick={() => startAttempt.mutate()} disabled={startAttempt.isPending}>
          {startAttempt.isPending && <Loader2 className="size-4 animate-spin" />}
          {info.status === "in_progress" ? "Resume test" : info.status === "submitted" ? "Start another attempt" : "Start test"}
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <Card className="mx-auto w-full max-w-4xl">
        <CardHeader>
          <CardTitle>{info?.test.title ?? "Student Test"}</CardTitle>
          {info && (
            <CardDescription>
              {info.course?.title} · {info.student?.firstName} {info.student?.lastName}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>{body}</CardContent>
      </Card>
    </div>
  )
}
