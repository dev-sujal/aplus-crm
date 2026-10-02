import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { FlaskConical, Pencil, Plus, Play, Archive, Search, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { api, ApiRequestError } from "#lib/api-client"
import { testsApi } from "#lib/tests-api"
import type { Course, PaginatedResult, Test } from "#lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#components/ui/card"
import { Button } from "#components/ui/button"
import { Input } from "#components/ui/input"
import { Label } from "#components/ui/label"
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

// Safe getter for course ID that handles both id and _id from API responses
function getCourseSafeId(item: any): string {
  if (typeof item === "string") return item
  if (typeof item === "object" && item !== null) {
    return (item.id || (item as any)._id || "") as string
  }
  return ""
}

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

  // Auto-select first course only on initial load
  React.useEffect(() => {
    if (!courseFilter && courseQuery.data?.items.length) {
      const firstCourseId = getCourseSafeId(courseQuery.data.items[0])
      if (firstCourseId) {
        setCourseFilter(firstCourseId)
      }
    }
  }, [courseQuery.isLoading])

  const questionQuery = useQuery({
    queryKey: ["tests-question-pool", courseFilter],
    queryFn: () => testsApi.listQuestions(`?course=${courseFilter}&limit=100`),
    enabled: Boolean(courseFilter),
  })

  const testQuery = useQuery({
    queryKey: ["tests-list", courseFilter, search, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams()
      if (courseFilter) params.set("course", courseFilter)
      if (search) params.set("search", search)
      if (statusFilter) params.set("status", statusFilter)
      params.set("limit", "50")
      const query = params.toString()
      return testsApi.listTests(query ? `?${query}` : "")
    },
  })

  const saveTest = useMutation({
    mutationFn: async () => {
      if (!form.course) throw new Error("Select a course")
      if (!form.title.trim()) throw new Error("Title is required")
      if (selectedQuestionIds.length === 0) throw new Error("Pick at least one question")

      // Filter out any null/undefined values and ensure all are strings
      const validQuestionIds = selectedQuestionIds.filter((id): id is string => 
        typeof id === "string" && id.length > 0
      )
      
      if (validQuestionIds.length === 0) throw new Error("Pick at least one valid question")

      const body = {
        course: form.course,
        title: form.title.trim(),
        instructions: form.instructions.trim(),
        timeLimitMinutes: Number(form.timeLimitMinutes) || 30,
        passPercentage: Number(form.passPercentage) || 40,
        multiAnswerScoring: form.multiAnswerScoring,
        negativeMarking: form.negativeMarking,
        negativeMarkingRate: Number(form.negativeMarkingRate) || 0,
        shuffleQuestions: form.shuffleQuestions,
        shuffleOptions: form.shuffleOptions,
        showResultImmediately: form.showResultImmediately,
        status: form.status,
        questionIds: validQuestionIds,
      }

      return editingTest
        ? api.patch<Test>(`/tests/${editingTest.id}`, body)
        : api.post<Test>("/tests", body)
    },
    onSuccess: () => {
      toast.success(editingTest ? "Test updated" : "Test created")
      queryClient.invalidateQueries({ queryKey: ["tests-list"] })
      setEditorOpen(false)
      setEditingTest(null)
    },
    onError: (error) => toast.error(error instanceof ApiRequestError ? error.message : error instanceof Error ? error.message : "Unable to save test"),
  })

  const publishTest = useMutation({
    mutationFn: (id: string) => testsApi.publishTest(id),
    onSuccess: () => {
      toast.success("Test published")
      queryClient.invalidateQueries({ queryKey: ["tests-list"] })
    },
    onError: () => toast.error("Unable to publish test"),
  })

  const archiveTest = useMutation({
    mutationFn: (id: string) => testsApi.archiveTest(id),
    onSuccess: () => {
      toast.success("Test archived")
      queryClient.invalidateQueries({ queryKey: ["tests-list"] })
    },
    onError: () => toast.error("Unable to archive test"),
  })

  function openCreate() {
    setEditingTest(null)
    const selectedCourse = courseFilter || getCourseSafeId(courseQuery.data?.items[0]) || ""
    setForm(initialForm(selectedCourse))
    setSelectedQuestionIds([])
    setEditorOpen(true)
  }

  function openEdit(test: Test) {
    const courseId = typeof test.course === "string" ? test.course : test.course.id
    setEditingTest(test)
    setForm({
      course: courseId,
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
    // Filter to ensure only valid string IDs
    const validQuestionIds = test.questions
      .map((question) => question.questionId)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
    setSelectedQuestionIds(validQuestionIds)
    setCourseFilter(courseId)
    setEditorOpen(true)
  }

  function toggleQuestion(questionId: string) {
    // Ensure questionId is a valid non-empty string
    if (typeof questionId !== "string" || questionId.length === 0) {
      console.warn("Invalid question ID:", questionId)
      return
    }
    setSelectedQuestionIds((current) =>
      current.includes(questionId) ? current.filter((id) => id !== questionId) : [...current, questionId]
    )
  }

  const currentQuestions = questionQuery.data?.items ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>          <Link
            to="/tests"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Back to tests
          </Link>          <h1 className="text-2xl font-semibold">Tests</h1>
          <p className="text-sm text-muted-foreground">Create drafts, publish, and manage course tests.</p>
        </div>
        <Button onClick={openCreate} disabled={!courseFilter}>
          <Plus className="size-4" /> Add test
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <select className="flex h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
          <option value="">Select a course…</option>
          {courseQuery.data?.items.map((course) => {
            const courseId = getCourseSafeId(course)
            return <option key={courseId} value={courseId}>{course.title}</option>
          })}
        </select>
        <Input placeholder="Search tests…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="flex h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "" | "draft" | "published" | "archived")}>
          <option value="">All statuses</option>
          <option value="draft">draft</option>
          <option value="published">published</option>
          <option value="archived">archived</option>
        </select>
        <Button variant="outline" onClick={() => testQuery.refetch()}>
          <Search className="size-4" /> Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><FlaskConical className="size-4" /> Tests</CardTitle>
          <CardDescription>{testQuery.isLoading ? "Loading…" : `${testQuery.data?.total ?? 0} result(s)`}</CardDescription>
        </CardHeader>
        <CardContent>
          {testQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !testQuery.data?.items.length ? (
            <p className="text-sm text-muted-foreground">No tests found.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {testQuery.data.items.map((test) => (
                <div key={test.id} className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{test.title}</p>
                    <p className="text-xs text-muted-foreground">{typeof test.course === "string" ? test.course : test.course.title} · {test.status} · {test.questionCount ?? test.questions.length} question(s)</p>
                    <p className="text-xs text-muted-foreground">Time limit {test.timeLimitMinutes} min · Pass {test.passPercentage}%</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(test)}><Pencil className="size-3.5" /> Edit</Button>
                    {test.status !== "published" && <Button size="sm" onClick={() => publishTest.mutate(test.id)} disabled={publishTest.isPending}><Play className="size-3.5" /> Publish</Button>}
                    {test.status !== "archived" && <Button variant="destructive" size="sm" onClick={() => archiveTest.mutate(test.id)}><Archive className="size-3.5" /> Archive</Button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{editingTest ? "Edit test" : "Add test"}</DialogTitle>
            <DialogDescription>Choose a course, configure the test, and pick questions from its bank.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="grid gap-1.5">
                <Label>Course</Label>
                <select className="flex h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" value={form.course} onChange={(e) => setForm((current) => ({ ...current, course: e.target.value }))}>
                  <option value="">Select a course…</option>
                  {courseQuery.data?.items.map((course) => {
                    const courseId = getCourseSafeId(course)
                    return <option key={courseId} value={courseId}>{course.title}</option>
                  })}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label>Title</Label>
                <Input value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label>Instructions</Label>
                <textarea className="flex min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm" value={form.instructions} onChange={(e) => setForm((current) => ({ ...current, instructions: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5"><Label>Time limit (min)</Label><Input type="number" min={1} value={form.timeLimitMinutes} onChange={(e) => setForm((current) => ({ ...current, timeLimitMinutes: e.target.value }))} /></div>
                <div className="grid gap-1.5"><Label>Pass %</Label><Input type="number" min={0} max={100} value={form.passPercentage} onChange={(e) => setForm((current) => ({ ...current, passPercentage: e.target.value }))} /></div>
                <div className="grid gap-1.5"><Label>Multiple scoring</Label><select className="flex h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" value={form.multiAnswerScoring} onChange={(e) => setForm((current) => ({ ...current, multiAnswerScoring: e.target.value as "all_correct" | "partial" }))}><option value="partial">partial</option><option value="all_correct">all_correct</option></select></div>
                <div className="grid gap-1.5"><Label>Negative mark rate</Label><Input type="number" min={0} step="0.01" value={form.negativeMarkingRate} onChange={(e) => setForm((current) => ({ ...current, negativeMarkingRate: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.negativeMarking} onChange={(e) => setForm((current) => ({ ...current, negativeMarking: e.target.checked }))} /> Negative marking</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.shuffleQuestions} onChange={(e) => setForm((current) => ({ ...current, shuffleQuestions: e.target.checked }))} /> Shuffle questions</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.shuffleOptions} onChange={(e) => setForm((current) => ({ ...current, shuffleOptions: e.target.checked }))} /> Shuffle options</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.showResultImmediately} onChange={(e) => setForm((current) => ({ ...current, showResultImmediately: e.target.checked }))} /> Show result immediately</label>
              </div>
              <div className="grid gap-1.5">
                <Label>Status</Label>
                <select className="flex h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" value={form.status} onChange={(e) => setForm((current) => ({ ...current, status: e.target.value as TestFormState["status"] }))}>
                  <option value="draft">draft</option>
                  <option value="published">published</option>
                  <option value="archived">archived</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Question picker</Label>
                <span className="text-xs text-muted-foreground">{selectedQuestionIds.length} selected</span>
              </div>
              {!form.course ? (
                <p className="text-sm text-muted-foreground">Select a course to load its questions.</p>
              ) : questionQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading questions…</p>
              ) : !currentQuestions.length ? (
                <p className="text-sm text-muted-foreground">No questions available for this course.</p>
              ) : (
                <div className="max-h-[50vh] overflow-auto rounded-xl border border-border">
                  {currentQuestions.map((question) => {
                    const questionId = typeof question.id === "string" ? question.id : (question as any)._id
                    const selected = questionId && selectedQuestionIds.includes(questionId)
                    return (
                      <button key={questionId} type="button" onClick={() => questionId && toggleQuestion(questionId)} className={`flex w-full flex-col gap-1 border-b border-border px-3 py-3 text-left text-sm last:border-b-0 ${selected ? "bg-primary/10" : "hover:bg-muted"}`}>
                        <span className="font-medium">{question.text}</span>
                        <span className="text-xs text-muted-foreground">{question.type} · {question.topic || "No topic"} · {question.difficulty} · marks {question.marks}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button type="button" disabled={saveTest.isPending} onClick={() => saveTest.mutate()}>{saveTest.isPending ? "Saving…" : editingTest ? "Save test" : "Create test"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}