import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { api, ApiRequestError } from "#lib/api-client"
import { useAuth } from "#providers/auth-context"
import type { Course, PaginatedResult } from "#lib/types"
import { Button } from "#components/ui/button"
import { Input } from "#components/ui/input"
import { Label } from "#components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "#components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "#components/ui/dialog"

const courseSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().default(""),
  fee: z.coerce.number().min(0, "Fee must be 0 or more"),
  durationWeeks: z.coerce.number().min(0).optional().nullable(),
  maxSeats: z.coerce.number().min(0).optional().nullable(),
  category: z.string().optional().default(""),
  instructorName: z.string().optional().default(""),
  startDate: z.string().optional().default(""),
  endDate: z.string().optional().default(""),
  status: z.enum(["active", "inactive"]).default("active"),
})
type CourseFormInput = z.input<typeof courseSchema>
type CourseFormValues = z.output<typeof courseSchema>

const emptyForm: CourseFormInput = {
  title: "",
  description: "",
  fee: 0,
  durationWeeks: null,
  maxSeats: null,
  category: "",
  instructorName: "",
  startDate: "",
  endDate: "",
  status: "active",
}

export default function CoursesPage() {
  const { user, can } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<"" | "active" | "inactive">("")
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingCourse, setEditingCourse] = React.useState<Course | null>(null)

  const canEdit = user?.role === "owner" || can("courses", "edit")
  const canCreateOrDelete = user?.role === "owner"

  const params = new URLSearchParams()
  if (search) params.set("search", search)
  if (statusFilter) params.set("status", statusFilter)

  const { data, isLoading } = useQuery({
    queryKey: ["courses", search, statusFilter],
    queryFn: () => api.get<PaginatedResult<Course>>(`/courses?${params.toString()}`),
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CourseFormInput, unknown, CourseFormValues>({
    resolver: zodResolver(courseSchema),
    defaultValues: emptyForm,
  })

  const openCreate = () => {
    setEditingCourse(null)
    reset(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (course: Course) => {
    setEditingCourse(course)
    reset({
      title: course.title,
      description: course.description,
      fee: course.fee,
      durationWeeks: course.durationWeeks,
      maxSeats: course.maxSeats,
      category: course.category,
      instructorName: course.instructorName,
      startDate: course.startDate ? course.startDate.slice(0, 10) : "",
      endDate: course.endDate ? course.endDate.slice(0, 10) : "",
      status: course.status,
    })
    setDialogOpen(true)
  }

  const saveCourse = useMutation({
    mutationFn: (values: CourseFormValues) => {
      const payload = {
        ...values,
        startDate: values.startDate || null,
        endDate: values.endDate || null,
      }
      return editingCourse
        ? api.patch(`/courses/${editingCourse.id}`, payload)
        : api.post("/courses", payload)
    },
    onSuccess: () => {
      toast.success(editingCourse ? "Course updated" : "Course created")
      queryClient.invalidateQueries({ queryKey: ["courses"] })
      setDialogOpen(false)
    },
    onError: (err) => {
      toast.error(err instanceof ApiRequestError ? err.message : "Failed to save course")
    },
  })

  const deleteCourse = useMutation({
    mutationFn: (id: string) => api.delete(`/courses/${id}`),
    onSuccess: () => {
      toast.success("Course deleted")
      queryClient.invalidateQueries({ queryKey: ["courses"] })
    },
    onError: () => toast.error("Failed to delete course"),
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold">Courses</h1>
          <p className="text-sm text-muted-foreground">
            {data?.total ?? 0} course{data?.total === 1 ? "" : "s"}
          </p>
        </div>
        {canCreateOrDelete && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger
              render={
                <Button onClick={openCreate}>
                  <Plus className="size-4" /> Add course
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCourse ? "Edit course" : "Add course"}</DialogTitle>
                <DialogDescription>
                  {editingCourse
                    ? "Update the course details below."
                    : "Fill in the course details to add it to the catalog."}
                </DialogDescription>
              </DialogHeader>
              <form
                className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1"
                onSubmit={handleSubmit((values) => saveCourse.mutate(values))}
                noValidate
              >
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="title">Course name</Label>
                  <Input id="title" {...register("title")} />
                  {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="description">Description</Label>
                  <textarea
                    id="description"
                    rows={3}
                    className="flex w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                    {...register("description")}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="fee">Fee</Label>
                    <Input id="fee" type="number" step="0.01" {...register("fee")} />
                    {errors.fee && <p className="text-xs text-destructive">{errors.fee.message}</p>}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="durationWeeks">Duration (weeks)</Label>
                    <Input id="durationWeeks" type="number" {...register("durationWeeks")} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="startDate">Start date</Label>
                    <Input id="startDate" type="date" {...register("startDate")} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="endDate">End date</Label>
                    <Input id="endDate" type="date" {...register("endDate")} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="category">Category</Label>
                    <Input id="category" {...register("category")} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="maxSeats">Max seats</Label>
                    <Input id="maxSeats" type="number" {...register("maxSeats")} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="instructorName">Instructor (optional)</Label>
                    <Input id="instructorName" {...register("instructorName")} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="status">Status</Label>
                    <select
                      id="status"
                      className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                      {...register("status")}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isSubmitting || saveCourse.isPending}>
                    {saveCourse.isPending ? "Saving…" : editingCourse ? "Save changes" : "Create course"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Search courses…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <select
          className="flex h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !data?.items.length ? (
        <p className="text-sm text-muted-foreground">No courses found.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((course) => (
            <Card key={course.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{course.title}</CardTitle>
                  <span
                    className={
                      "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium " +
                      (course.status === "active"
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground")
                    }
                  >
                    {course.status}
                  </span>
                </div>
                {course.category && <CardDescription>{course.category}</CardDescription>}
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                {course.description && (
                  <p className="line-clamp-2 text-muted-foreground">{course.description}</p>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Fee: ₹{course.fee}</span>
                  {course.durationWeeks != null && <span>{course.durationWeeks} weeks</span>}
                  {course.maxSeats != null && <span>Max {course.maxSeats} seats</span>}
                  {course.instructorName && <span>{course.instructorName}</span>}
                </div>
                {canEdit && (
                  <div className="mt-2 flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(course)}>
                      <Pencil className="size-3.5" /> Edit
                    </Button>
                    {canCreateOrDelete && (
                      <Button
                        variant="destructive"
                        size="icon"
                        aria-label="Delete course"
                        onClick={() => {
                          if (confirm(`Delete "${course.title}"?`)) deleteCourse.mutate(course.id)
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
