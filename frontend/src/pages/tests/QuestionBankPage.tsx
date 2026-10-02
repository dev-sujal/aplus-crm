import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { BookOpen, Plus, Pencil, Trash2, Archive, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { api, ApiRequestError } from "#lib/api-client"
import type { Course, PaginatedResult, Question, QuestionDifficulty, QuestionType } from "#lib/types"
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

type OptionDraft = { id: string; text: string }
type QuestionFormState = {
  course: string
  type: QuestionType
  text: string
  marks: string
  explanation: string
  topic: string
  difficulty: QuestionDifficulty
}

const QUESTION_TYPES: QuestionType[] = ["single", "multiple"]
const DIFFICULTIES: QuestionDifficulty[] = ["easy", "medium", "hard"]

function newOption(): OptionDraft {
  return { id: globalThis.crypto.randomUUID(), text: "" }
}

function emptyForm(course = ""): QuestionFormState {
  return {
    course,
    type: "single",
    text: "",
    marks: "1",
    explanation: "",
    topic: "",
    difficulty: "medium",
  }
}

function getCourseId(course: Question["course"]): string {
  return typeof course === "string" ? course : course.id
}

// Safe getter for course ID that handles both id and _id from API responses
function getCourseSafeId(item: any): string {
  if (typeof item === "string") return item
  if (typeof item === "object" && item !== null) {
    return (item.id || (item as any)._id || "") as string
  }
  return ""
}

export default function QuestionBankPage() {
  const queryClient = useQueryClient()
  const [course, setCourse] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [typeFilter, setTypeFilter] = React.useState<"" | QuestionType>("")
  const [topicFilter, setTopicFilter] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<"" | "active" | "archived">("")
  const [editorOpen, setEditorOpen] = React.useState(false)
  const [editingQuestion, setEditingQuestion] = React.useState<Question | null>(null)
  const [form, setForm] = React.useState<QuestionFormState>(emptyForm())
  const [options, setOptions] = React.useState<OptionDraft[]>([newOption(), newOption()])
  const [correctOptionIds, setCorrectOptionIds] = React.useState<string[]>([])

  const courseQuery = useQuery({
    queryKey: ["tests-courses"],
    queryFn: () => api.get<PaginatedResult<Course>>("/courses?limit=100"),
  })

  // Auto-select first course only on initial load
  React.useEffect(() => {
    if (!course && courseQuery.data?.items.length) {
      const firstCourseId = getCourseSafeId(courseQuery.data.items[0])
      if (firstCourseId) {
        setCourse(firstCourseId)
      }
    }
  }, [courseQuery.isLoading])

  const query = new URLSearchParams()
  if (course) query.set("course", course)
  if (search) query.set("search", search)
  if (typeFilter) query.set("type", typeFilter)
  if (topicFilter) query.set("topic", topicFilter)
  if (statusFilter) query.set("status", statusFilter)

  const questionsQuery = useQuery({
    queryKey: ["tests-questions", course, search, typeFilter, topicFilter, statusFilter],
    queryFn: () => api.get<PaginatedResult<Question>>(`/tests/questions?${query.toString()}`),
    enabled: Boolean(course),
  })

  const saveQuestion = useMutation({
    mutationFn: async () => {
      // Ensure course is selected
      if (!form.course) {
        throw new Error("Please select a course")
      }

      const body = {
        course: form.course,
        type: form.type,
        text: form.text.trim(),
        options: options.map((option) => ({ id: option.id, text: option.text.trim() })).filter((option) => option.text),
        correctOptionIds,
        marks: Number(form.marks) || 1,
        explanation: form.explanation.trim(),
        topic: form.topic.trim(),
        difficulty: form.difficulty,
      }

      if (body.options.length < 2 || body.options.length > 6) {
        throw new Error("Questions must have between 2 and 6 options")
      }
      if (body.type === "single" && body.correctOptionIds.length !== 1) {
        throw new Error("Single answer questions must have exactly one correct option")
      }
      if (body.type === "multiple" && body.correctOptionIds.length < 1) {
        throw new Error("Multiple answer questions must have at least one correct option")
      }

      return editingQuestion
        ? api.patch<Question>(`/tests/questions/${editingQuestion.id}`, body)
        : api.post<Question>("/tests/questions", body)
    },
    onSuccess: () => {
      toast.success(editingQuestion ? "Question updated" : "Question created")
      queryClient.invalidateQueries({ queryKey: ["tests-questions"] })
      setEditorOpen(false)
      setEditingQuestion(null)
    },
    onError: (error) => {
      toast.error(error instanceof ApiRequestError ? error.message : error instanceof Error ? error.message : "Unable to save question")
    },
  })

  const archiveQuestion = useMutation({
    mutationFn: (id: string) => api.post<Question>(`/tests/questions/${id}/archive`),
    onSuccess: () => {
      toast.success("Question archived")
      queryClient.invalidateQueries({ queryKey: ["tests-questions"] })
    },
    onError: () => toast.error("Unable to archive question"),
  })

  const deleteQuestion = useMutation({
    mutationFn: (id: string) => api.delete<void>(`/tests/questions/${id}`),
    onSuccess: () => {
      toast.success("Question removed")
      queryClient.invalidateQueries({ queryKey: ["tests-questions"] })
    },
    onError: () => toast.error("Unable to delete question"),
  })

  function openCreate() {
    setEditingQuestion(null)
    const selectedCourse = course || getCourseSafeId(courseQuery.data?.items[0]) || ""
    setForm(emptyForm(selectedCourse))
    setOptions([newOption(), newOption()])
    setCorrectOptionIds([])
    setEditorOpen(true)
  }

  function openEdit(question: Question) {
    const courseId = getCourseId(question.course)
    setEditingQuestion(question)
    setForm({
      course: courseId,
      type: question.type,
      text: question.text,
      marks: String(question.marks),
      explanation: question.explanation || "",
      topic: question.topic || "",
      difficulty: question.difficulty,
    })
    setOptions(question.options.length ? question.options.map((option) => ({ ...option })) : [newOption(), newOption()])
    setCorrectOptionIds([...question.correctOptionIds])
    setCourse(courseId)
    setEditorOpen(true)
  }

  function updateOptionText(id: string, text: string) {
    setOptions((current) => current.map((option) => (option.id === id ? { ...option, text } : option)))
  }

  function addOption() {
    setOptions((current) => (current.length >= 6 ? current : [...current, newOption()]))
  }

  function removeOption(id: string) {
    setOptions((current) => current.filter((option) => option.id !== id))
    setCorrectOptionIds((current) => current.filter((optionId) => optionId !== id))
  }

  function toggleCorrectOption(id: string) {
    setCorrectOptionIds((current) => {
      if (form.type === "single") return [id]
      return current.includes(id) ? current.filter((optionId) => optionId !== id) : [...current, id]
    })
  }

  function handleTypeChange(nextType: QuestionType) {
    setForm((current) => ({ ...current, type: nextType }))
    if (nextType === "single" && correctOptionIds.length > 1) {
      setCorrectOptionIds((current) => current.slice(0, 1))
    }
  }

  function canSave() {
    return form.course && form.text.trim() && options.filter((option) => option.text.trim()).length >= 2 && correctOptionIds.length > 0
  }

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
          <h1 className="text-2xl font-semibold">Question Bank</h1>
          <p className="text-sm text-muted-foreground">Create and manage course-wise MCQ questions.</p>
        </div>
        <Button onClick={openCreate} disabled={!course}>
          <Plus className="size-4" /> Add question
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <select className="flex h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" value={course} onChange={(e) => setCourse(e.target.value)}>
          <option value="">Select a course…</option>
          {courseQuery.data?.items.map((item) => {
            const itemId = getCourseSafeId(item)
            return <option key={itemId} value={itemId}>{item.title}</option>
          })}
        </select>
        <select className="flex h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as "" | QuestionType)}>
          <option value="">All types</option>
          {QUESTION_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <Input placeholder="Search questions…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Input placeholder="Filter by topic…" value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)} />
        <select className="flex h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "" | "active" | "archived")}>
          <option value="">All statuses</option>
          <option value="active">active</option>
          <option value="archived">archived</option>
        </select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><BookOpen className="size-4" /> Questions</CardTitle>
          <CardDescription>
            {course ? (questionsQuery.isLoading ? "Loading…" : `${questionsQuery.data?.total ?? 0} result(s)`) : "Choose a course to view its question bank."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!course ? (
            <p className="text-sm text-muted-foreground">Pick a course to start.</p>
          ) : questionsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !questionsQuery.data?.items.length ? (
            <p className="text-sm text-muted-foreground">No questions found.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {questionsQuery.data.items.map((question) => (
                <div key={question.id} className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium">{question.text}</p>
                    <p className="text-xs text-muted-foreground">
                      {question.type} · {question.topic || "No topic"} · {question.difficulty} · {question.status}
                    </p>
                    <p className="text-xs text-muted-foreground">Marks: {question.marks} · Options: {question.options.length}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(question)}>
                      <Pencil className="size-3.5" /> Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => archiveQuestion.mutate(question.id)} disabled={archiveQuestion.isPending}>
                      <Archive className="size-3.5" /> Archive
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => {
                      if (window.confirm("Delete this question? If it was already used in a taken test, it will be archived instead.")) {
                        deleteQuestion.mutate(question.id)
                      }
                    }}>
                      <Trash2 className="size-3.5" /> Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingQuestion ? "Edit question" : "Add question"}</DialogTitle>
            <DialogDescription>Course-wise MCQ question editor.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="course">Course</Label>
              <select id="course" className="flex h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" value={form.course} onChange={(e) => setForm((current) => ({ ...current, course: e.target.value }))}>
                <option value="">Select a course…</option>
                {courseQuery.data?.items.map((item) => {
                  const itemId = getCourseSafeId(item)
                  return <option key={itemId} value={itemId}>{item.title}</option>
                })}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="type">Type</Label>
              <select id="type" className="flex h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" value={form.type} onChange={(e) => handleTypeChange(e.target.value as QuestionType)}>
                {QUESTION_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <Label htmlFor="text">Question text</Label>
              <textarea id="text" rows={3} className="flex w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm" value={form.text} onChange={(e) => setForm((current) => ({ ...current, text: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="marks">Marks</Label>
              <Input id="marks" type="number" min={1} value={form.marks} onChange={(e) => setForm((current) => ({ ...current, marks: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="difficulty">Difficulty</Label>
              <select id="difficulty" className="flex h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" value={form.difficulty} onChange={(e) => setForm((current) => ({ ...current, difficulty: e.target.value as QuestionDifficulty }))}>
                {DIFFICULTIES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="topic">Topic</Label>
              <Input id="topic" value={form.topic} onChange={(e) => setForm((current) => ({ ...current, topic: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <Label htmlFor="explanation">Explanation</Label>
              <textarea id="explanation" rows={3} className="flex w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm" value={form.explanation} onChange={(e) => setForm((current) => ({ ...current, explanation: e.target.value }))} />
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <Label>Options</Label>
            <Button type="button" variant="outline" size="sm" onClick={addOption} disabled={options.length >= 6}>
              <Plus className="size-3.5" /> Add option
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            {options.map((option, index) => {
              const isCorrect = correctOptionIds.includes(option.id)
              return (
                <div key={option.id} className="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-[1fr_auto_auto] md:items-center">
                  <div className="flex items-center gap-2">
                    <span className="w-6 text-xs text-muted-foreground">{index + 1}</span>
                    <Input value={option.text} onChange={(e) => updateOptionText(option.id, e.target.value)} placeholder={`Option ${index + 1}`} />
                  </div>
                  <Button type="button" variant={isCorrect ? "default" : "outline"} size="sm" onClick={() => toggleCorrectOption(option.id)}>
                    {form.type === "single" ? "Correct" : isCorrect ? "Selected" : "Select"}
                  </Button>
                  <Button type="button" variant="destructive" size="icon" onClick={() => removeOption(option.id)} disabled={options.length <= 2}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              )
            })}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button type="button" disabled={!canSave() || saveQuestion.isPending} onClick={() => saveQuestion.mutate()}>
              {saveQuestion.isPending ? "Saving…" : editingQuestion ? "Save question" : "Create question"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}