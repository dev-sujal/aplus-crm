import * as React from "react"
import { useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, ChevronLeft, ChevronRight, Clock3, Flag, Loader2, Send } from "lucide-react"
import { toast } from "sonner"
import { testsApi } from "#lib/tests-api"
import type { PublicAttemptResultResponse, PublicAttemptStartResponse } from "#lib/types"
import { Button } from "#components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#components/ui/card"
import { Checkbox } from "#components/ui/checkbox"

export default function PublicTestPage() {
  const { shareToken } = useParams<{ shareToken: string }>()
  const queryClient = useQueryClient()
  const assignmentQuery = useQuery({
    queryKey: ["public-test", shareToken],
    queryFn: () => testsApi.publicAssignment(shareToken ?? ""),
    enabled: Boolean(shareToken),
  })

  const [attempt, setAttempt] = React.useState<PublicAttemptStartResponse | null>(null)
  const [answers, setAnswers] = React.useState<Record<string, { selectedOptionIds: string[]; markedForReview: boolean }>>({})
  const [currentQuestionIndex, setCurrentQuestionIndex] = React.useState(0)
  const [submittedResult, setSubmittedResult] = React.useState<PublicAttemptResultResponse | null>(null)

  const startAttempt = useMutation({
    mutationFn: () => testsApi.startPublicAttempt(shareToken ?? ""),
    onSuccess: (data) => {
      setAttempt(data)
      setAnswers(Object.fromEntries(data.answers.map((answer) => [answer.questionId, { selectedOptionIds: answer.selectedOptionIds, markedForReview: answer.markedForReview }])) )
      setCurrentQuestionIndex(data.currentQuestionIndex ?? 0)
    },
    onError: () => toast.error("Unable to start test"),
  })

  const saveProgress = useMutation({
    mutationFn: () => testsApi.savePublicProgress(shareToken ?? "", {
      currentQuestionIndex,
      answers: (attempt?.test.questions ?? []).map((question) => ({
        questionId: question.questionId,
        selectedOptionIds: answers[question.questionId]?.selectedOptionIds ?? [],
        markedForReview: answers[question.questionId]?.markedForReview ?? false,
      })),
    }),
  })

  const submitAttempt = useMutation<PublicAttemptResultResponse>({
    mutationFn: async () => testsApi.submitPublicAttempt(shareToken ?? "", {
      answers: (attempt?.test.questions ?? []).map((question) => ({
        questionId: question.questionId,
        selectedOptionIds: answers[question.questionId]?.selectedOptionIds ?? [],
        markedForReview: answers[question.questionId]?.markedForReview ?? false,
      })),
    }) as Promise<PublicAttemptResultResponse>,
    onSuccess: async (data) => {
      setSubmittedResult(data)
      await queryClient.invalidateQueries({ queryKey: ["public-test-result", shareToken] })
    },
    onError: () => toast.error("Unable to submit test"),
  })

  const resultQuery = useQuery({
    queryKey: ["public-test-result", shareToken],
    queryFn: () => testsApi.publicResult(shareToken ?? ""),
    enabled: Boolean(submittedResult?.submitted),
  })

  React.useEffect(() => {
    if (shareToken && assignmentQuery.data && !attempt && !startAttempt.isPending) {
      startAttempt.mutate()
    }
  }, [assignmentQuery.data, attempt, shareToken, startAttempt])

  if (!shareToken) return <p className="p-6 text-sm text-muted-foreground">Missing share token.</p>

  if (assignmentQuery.isLoading || startAttempt.isPending) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <Card className="mx-auto w-full max-w-4xl">
        <CardHeader>
          <CardTitle>{assignmentQuery.data?.test.title ?? "Student Test Access"}</CardTitle>
          <CardDescription>{assignmentQuery.data?.course.title} · {assignmentQuery.data?.student.firstName} {assignmentQuery.data?.student.lastName}</CardDescription>
        </CardHeader>
        <CardContent>
          {resultQuery.data?.visible && resultQuery.data.result ? (
            <div className="space-y-3 text-sm">
              <p className="flex items-center gap-2 font-medium"><CheckCircle2 className="size-4 text-emerald-500" /> Test submitted</p>
              <p>Score: {resultQuery.data.result.score} / {resultQuery.data.result.totalMarks}</p>
              <p>Percentage: {resultQuery.data.result.percentage}%</p>
              <p>{resultQuery.data.result.passed ? "Passed" : "Not passed yet"}</p>
            </div>
          ) : submittedResult?.submitted && submittedResult.visible === false ? (
            <p className="text-sm text-muted-foreground">Your submission was received. Results are hidden for this test.</p>
          ) : attempt ? (
            <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
              <div className="space-y-4">
                <div className="rounded-xl border border-border p-4">
                  <p className="text-sm font-medium">Instructions</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{attempt.test.instructions}</p>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">Question {currentQuestionIndex + 1} of {attempt.test.questions.length}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="size-4" /> Expires {new Date(attempt.expiresAt).toLocaleString()}</div>
                  </div>
                  {attempt.test.questions[currentQuestionIndex] && (() => {
                    const activeQuestion = attempt.test.questions[currentQuestionIndex]
                    const currentAnswer = answers[activeQuestion.questionId]
                    return (
                      <div className="mt-4 space-y-4">
                        <p className="text-base font-medium">{activeQuestion.snapshot.text}</p>
                        <div className="space-y-2">
                          {activeQuestion.snapshot.options.map((option) => {
                            const selected = currentAnswer?.selectedOptionIds.includes(option.id) ?? false
                            const isSingle = activeQuestion.snapshot.type === "single"
                            return (
                              <button key={option.id} type="button" onClick={() => setAnswers((current) => {
                                const prev = current[activeQuestion.questionId]?.selectedOptionIds ?? []
                                const next = isSingle ? [option.id] : prev.includes(option.id) ? prev.filter((id) => id !== option.id) : [...prev, option.id]
                                return { ...current, [activeQuestion.questionId]: { selectedOptionIds: next, markedForReview: current[activeQuestion.questionId]?.markedForReview ?? false } }
                              })} className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm ${selected ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}>
                                <Checkbox checked={selected} readOnly />
                                <span>{option.text}</span>
                              </button>
                            )
                          })}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" onClick={() => setCurrentQuestionIndex((value) => Math.max(0, value - 1))} disabled={currentQuestionIndex === 0}><ChevronLeft className="size-4" /> Previous</Button>
                          <Button variant="outline" onClick={() => setCurrentQuestionIndex((value) => Math.min(attempt.test.questions.length - 1, value + 1))} disabled={currentQuestionIndex >= attempt.test.questions.length - 1}>Next <ChevronRight className="size-4" /></Button>
                          <Button variant="outline" onClick={() => setAnswers((current) => ({
                            ...current,
                            [activeQuestion.questionId]: {
                              selectedOptionIds: current[activeQuestion.questionId]?.selectedOptionIds ?? [],
                              markedForReview: !(current[activeQuestion.questionId]?.markedForReview ?? false),
                            },
                          }))}><Flag className="size-4" /> {currentAnswer?.markedForReview ? "Unmark" : "Mark"}</Button>
                          <Button variant="outline" onClick={() => saveProgress.mutate()}><Loader2 className={`size-4 ${saveProgress.isPending ? "animate-spin" : ""}`} /> Save</Button>
                          <Button onClick={() => submitAttempt.mutate()} disabled={submitAttempt.isPending}><Send className="size-4" /> Submit</Button>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>
              <div className="space-y-4">
                <div className="rounded-xl border border-border p-4 text-sm">
                  <p className="font-medium">Status</p>
                  <p className="mt-2 text-muted-foreground">{Object.values(answers).filter((answer) => answer.selectedOptionIds.length > 0).length} answered</p>
                </div>
                <div className="rounded-xl border border-border p-4 text-sm">
                  <p className="font-medium">Questions</p>
                  <div className="mt-3 grid grid-cols-5 gap-2">
                    {attempt.test.questions.map((question, index) => (
                      <button key={question.questionId} type="button" onClick={() => setCurrentQuestionIndex(index)} className={`rounded-lg border px-2 py-1 text-xs ${currentQuestionIndex === index ? "border-primary bg-primary/10" : "border-border"}`}>
                        {index + 1}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Unable to start test.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}