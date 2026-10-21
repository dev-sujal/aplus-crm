import * as React from "react"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { FlaskConical, Pencil, Plus, Play, Archive, ArrowLeft, Users } from "lucide-react"
import { toast } from "sonner"
import { api } from "#lib/api-client"
import { testsApi } from "#lib/tests-api"
import { errorMessage, parseNumber, refId, refTitle } from "#lib/test-utils"
import type { Course, PaginatedResult, Test } from "#lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#components/ui/card"
import { Button } from "#components/ui/button"
import { Input } from "#components/ui/input"
import { Label } from "#components/ui/label"
import { Pagination } from "#components/ui/pagination"
import { useClampPage, usePage } from "#lib/use-pagination"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#components/ui/dialog"

type TestFormState = {
  course: string
  title: string
  instructions: string
  timeLimitMinutes: string
  passPercentage: string
  multiAnswerScoring: "all_correct" | "partial"
  negativeMarking: boolean
  negativeMarkingRate: string
  shuffleQuestions: boolean
  shuffleOptions: boolean
  showResultImmediately: boolean
  status: "draft" | "published" | "archived"
}

const initialForm = (course = ""): TestFormState => ({
  course,
  title: "",
  instructions: "",
  timeLimitMinutes: "30",
  passPercentage: "40",
  multiAnswerScoring: "partial",
  negativeMarking: false,
  negativeMarkingRate: "0.25",
  shuffleQuestions: false,
  shuffleOptions: false,
  showResultImmediately: true,
  status: "draft",
})

const selectClass = "flex h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
const PAGE_SIZE = 10

export default function TestListPage() {
  const queryClient = useQueryClient()
  const [courseFilter, setCourseFilter] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<"" | "draft" | "published" | "archived">("")
  const [editorOpen, setEditorOpen] = React.useState(false)
  const [editingTest, setEditingTest] = React.useState<Test | null>(null)
  const [selectedQuestionIds, setSelectedQuestionIds] = React.useState<string[]>([])
  const [form, setForm] = React.useState<TestFormState>(initialForm())

  const courseQuery = useQuery({
    queryKey: ["tests-courses"],
    queryFn: () => api.get<PaginatedResult<Course>>("/courses?limit=100"),
  })
  const courses = courseQuery.data?.items ?? []

  // Questions come from the course chosen *inside the editor*, not the list filter.
  const questionQuery = useQuery({
    queryKey: ["tests-question-pool", form.course],
    queryFn: () => testsApi.listQuestions(`?course=${form.course}&status=active&limit=100`),
    enabled: editorOpen && Boolean(form.course),
  })

  const [page, setPage] = usePage(`${courseFilter}|${search.trim()}|${statusFilter}`)

  const testQuery = useQuery({
    queryKey: ["tests-list", courseFilter, search, statusFilter, page],
    queryFn: () => {
      const params = new URLSearchParams()
      if (courseFilter) params.set("course", courseFilter)
      if (search.trim()) params.set("search", search.trim())
      if (statusFilter) params.set("status", statusFilter)
      params.set("page", String(page))
      params.set("limit", String(PAGE_SIZE))
      return testsApi.listTests(`?${params.toString()}`)
    },
    placeholderData: keepPreviousData,
  })
  useClampPage(page, testQuery.data?.totalPages, setPage, !testQuery.isPlaceholderData)

  const saveTest = useMutation({
    mutationFn: async () => {
      if (!form.course) throw new Error("Select a course")
      if (!form.title.trim()) throw new Error("Title is required")
      if (selectedQuestionIds.length === 0) throw new Error("Pick at least one question")

      const body = {
        course: form.course,
        title: form.title.trim(),
        instructions: form.instructions.trim(),
        timeLimitMinutes: Math.max(1, parseNumber(form.timeLimitMinutes, 30)),
        passPercentage: Math.min(100, Math.max(0, parseNumber(form.passPercentage, 40))),
        multiAnswerScoring: form.multiAnswerScoring,
        negativeMarking: form.negativeMarking,
        negativeMarkingRate: Math.max(0, parseNumber(form.negativeMarkingRate, 0.25)),
        shuffleQuestions: form.shuffleQuestions,
        shuffleOptions: form.shuffleOptions,
        showResultImmediately: form.showResultImmediately,
        status: form.status,
        questionIds: selectedQuestionIds,
      }
      return editingTest ? testsApi.updateTest(editingTest.id, body) : testsApi.createTest(body)
    },
    onSuccess: () => {
      toast.success(editingTest ? "Test updated" : "Test created")
      queryClient.invalidateQueries({ queryKey: ["tests-list"] })
      queryClient.invalidateQueries({ queryKey: ["tests-assign-tests"] })
      setEditorOpen(false)
      setEditingTest(null)
    },
    onError: (error) => toast.error(errorMessage(error, "Unable to save test")),
  })

  const publishTest = useMutation({
    mutationFn: (id: string) => testsApi.publishTest(id),
    onSuccess: () => {
      toast.success("Test published")
      queryClient.invalidateQueries({ queryKey: ["tests-list"] })
      queryClient.invalidateQueries({ queryKey: ["tests-assign-tests"] })
    },
    onError: (error) => toast.error(errorMessage(error, "Unable to publish test")),
  })

  const archiveTest = useMutation({
    mutationFn: (id: string) => testsApi.archiveTest(id),
    onSuccess: () => {
      toast.success("Test archived")
      queryClient.invalidateQueries({ queryKey: ["tests-list"] })
      queryClient.invalidateQueries({ queryKey: ["tests-assign-tests"] })
    },
    onError: (error) => toast.error(errorMessage(error, "Unable to archive test")),
  })

  function openCreate() {
    setEditingTest(null)
    setForm(initialForm(courseFilter || courses[0]?.id || ""))
    setSelectedQuestionIds([])
    setEditorOpen(true)
  }

  function openEdit(test: Test) {
    setEditingTest(test)
    setForm({
      course: refId(test.course),
      title: test.title,
      instructions: test.instructions || "",
      timeLimitMinutes: String(test.timeLimitMinutes),
      passPercentage: String(test.passPercentage),
      multiAnswerScoring: test.multiAnswerScoring,
      negativeMarking: test.negativeMarking,
      negativeMarkingRate: String(test.negativeMarkingRate),
      shuffleQuestions: test.shuffleQuestions,
      shuffleOptions: test.shuffleOptions,
      showResultImmediately: test.showResultImmediately,
      status: test.status,
    })
    setSelectedQuestionIds(
      [...test.questions].sort((a, b) => a.order - b.order).map((question) => String(question.questionId))
    )
    setEditorOpen(true)
  }

  function changeCourse(courseId: string) {
    if (courseId === form.course) return
    // Questions belong to one course, so a different course means a fresh selection.
    setForm((current) => ({ ...current, course: courseId }))
    setSelectedQuestionIds([])
  }

  function toggleQuestion(questionId: string) {
    setSelectedQuestionIds((current) =>
      current.includes(questionId) ? current.filter((id) => id !== questionId) : [...current, questionId]
    )
  }

  function confirmArchive(test: Test) {
    if (window.confirm(`Archive "${test.title}"? It can no longer be assigned.`)) archiveTest.mutate(test.id)
  }

  const pool = questionQuery.data?.items ?? []
  const poolIds = new Set(pool.map((question) => question.id))
  const hiddenSelected = selectedQuestionIds.filter((id) => !poolIds.has(id)).length
  const setField = <K extends keyof TestFormState>(key: K, value: TestFormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to="/tests" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5" /> Back to tests
          </Link>
          <h1 className="text-2xl font-semibold">Tests</h1>
          <p className="text-sm text-muted-foreground">Create drafts, publish, and manage course tests.</p>
        </div>
        <Button onClick={openCreate} disabled={courseQuery.isLoading || courses.length === 0}>
          <Plus className="size-4" /> Add test
        </Button>
      </div>

      {!courseQuery.isLoading && courses.length === 0 && (
        <p className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
          No courses yet. Create a course (and add questions to its question bank) before creating a test.
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <select className={selectClass} value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
          <option value="">All courses</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>{course.title}</option>
          ))}
        </select>
        <Input placeholder="Search tests…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={selectClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
          <option value="">All statuses</option>
          <option value="draft">draft</option>
          <option value="published">published</option>
          <option value="archived">archived</option>
        </select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><FlaskConical className="size-4" /> Tests</CardTitle>
          <CardDescription>
            {testQuery.isLoading ? "Loading…" : testQuery.isError ? "Failed to load" : `${testQuery.data?.total ?? 0} result(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {testQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : testQuery.isError ? (
            <p className="text-sm text-destructive">{errorMessage(testQuery.error, "Unable to load tests")}</p>
          ) : testQuery.data?.total === 0 ? (
            <p className="text-sm text-muted-foreground">No tests found.</p>
          ) : !testQuery.data?.items.length ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
            <div className="flex flex-col divide-y divide-border">
              {testQuery.data.items.map((test) => (
                <div key={test.id} className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{test.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {refTitle(test.course)} · {test.status} · {test.questionCount ?? test.questions.length} question(s)
                    </p>
                    <p className="text-xs text-muted-foreground">Time limit {test.timeLimitMinutes} min · Pass {test.passPercentage}%</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(test)}><Pencil className="size-3.5" /> Edit</Button>
                    {test.status !== "published" && (
                      <Button size="sm" onClick={() => publishTest.mutate(test.id)} disabled={publishTest.isPending}>
                        <Play className="size-3.5" /> Publish
                      </Button>
                    )}
                    {test.status === "published" && (
                      <Button variant="outline" size="sm" nativeButton={false} render={<Link to={`/tests/assignments?test=${test.id}`} />}>
                        <Users className="size-3.5" /> Assign
                      </Button>
                    )}
                    {test.status !== "archived" && (
                      <Button variant="destructive" size="sm" onClick={() => confirmArchive(test)} disabled={archiveTest.isPending}>
                        <Archive className="size-3.5" /> Archive
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Pagination
              page={testQuery.data.page}
              totalPages={testQuery.data.totalPages}
              total={testQuery.data.total}
              limit={testQuery.data.limit}
              onPageChange={setPage}
              isFetching={testQuery.isFetching}
              className="mt-3 border-t border-border pt-3"
            />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTest ? "Edit test" : "Add test"}</DialogTitle>
            <DialogDescription>Choose a course, configure the test, and pick questions from its bank.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="grid gap-1.5">
                <Label>Course</Label>
                <select className={selectClass} value={form.course} onChange={(e) => changeCourse(e.target.value)}>
                  <option value="">Select a course…</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>{course.title}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label>Title</Label>
                <Input value={form.title} onChange={(e) => setField("title", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Instructions</Label>
                <textarea className="flex min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm" value={form.instructions} onChange={(e) => setField("instructions", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5"><Label>Time limit (min)</Label><Input type="number" min={1} value={form.timeLimitMinutes} onChange={(e) => setField("timeLimitMinutes", e.target.value)} /></div>
                <div className="grid gap-1.5"><Label>Pass %</Label><Input type="number" min={0} max={100} value={form.passPercentage} onChange={(e) => setField("passPercentage", e.target.value)} /></div>
                <div className="grid gap-1.5">
                  <Label>Multiple-answer scoring</Label>
                  <select className={selectClass} value={form.multiAnswerScoring} onChange={(e) => setField("multiAnswerScoring", e.target.value as TestFormState["multiAnswerScoring"])}>
                    <option value="partial">partial credit</option>
                    <option value="all_correct">all must be correct</option>
                  </select>
                </div>
                <div className="grid gap-1.5"><Label>Negative mark rate</Label><Input type="number" min={0} step="0.01" value={form.negativeMarkingRate} disabled={!form.negativeMarking} onChange={(e) => setField("negativeMarkingRate", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.negativeMarking} onChange={(e) => setField("negativeMarking", e.target.checked)} /> Negative marking</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.shuffleQuestions} onChange={(e) => setField("shuffleQuestions", e.target.checked)} /> Shuffle questions</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.shuffleOptions} onChange={(e) => setField("shuffleOptions", e.target.checked)} /> Shuffle options</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.showResultImmediately} onChange={(e) => setField("showResultImmediately", e.target.checked)} /> Show result immediately</label>
              </div>
              <div className="grid gap-1.5">
                <Label>Status</Label>
                <select className={selectClass} value={form.status} onChange={(e) => setField("status", e.target.value as TestFormState["status"])}>
                  <option value="draft">draft</option>
                  <option value="published">published (can be assigned)</option>
                  {editingTest && <option value="archived">archived</option>}
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Question picker</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{selectedQuestionIds.length} selected</span>
                  {pool.length > 0 && (
                    <Button type="button" variant="ghost" size="xs" onClick={() => setSelectedQuestionIds(pool.map((question) => question.id))}>Select all</Button>
                  )}
                  {selectedQuestionIds.length > 0 && (
                    <Button type="button" variant="ghost" size="xs" onClick={() => setSelectedQuestionIds([])}>Clear</Button>
                  )}
                </div>
              </div>
              {hiddenSelected > 0 && (
                <p className="text-xs text-muted-foreground">{hiddenSelected} selected question(s) are archived and kept as they are.</p>
              )}
              {!form.course ? (
                <p className="text-sm text-muted-foreground">Select a course to load its questions.</p>
              ) : questionQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading questions…</p>
              ) : questionQuery.isError ? (
                <p className="text-sm text-destructive">{errorMessage(questionQuery.error, "Unable to load questions")}</p>
              ) : !pool.length ? (
                <p className="text-sm text-muted-foreground">
                  No active questions for this course. Add some in the <Link className="underline" to="/tests/questions">Question Bank</Link> first.
                </p>
              ) : (
                <div className="max-h-[50vh] overflow-auto rounded-xl border border-border">
                  {pool.map((question) => {
                    const position = selectedQuestionIds.indexOf(question.id)
                    const selected = position >= 0
                    return (
                      <button
                        key={question.id}
                        type="button"
                        onClick={() => toggleQuestion(question.id)}
                        className={`flex w-full items-start gap-3 border-b border-border px-3 py-3 text-left text-sm last:border-b-0 ${selected ? "bg-primary/10" : "hover:bg-muted"}`}
                      >
                        <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] ${selected ? "bg-primary text-primary-foreground" : "border border-border"}`}>
                          {selected ? position + 1 : ""}
                        </span>
                        <span className="flex flex-col gap-1">
                          <span className="font-medium">{question.text}</span>
                          <span className="text-xs text-muted-foreground">{question.type} · {question.topic || "No topic"} · {question.difficulty} · marks {question.marks}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button type="button" disabled={saveTest.isPending} onClick={() => saveTest.mutate()}>
              {saveTest.isPending ? "Saving…" : editingTest ? "Save test" : "Create test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
