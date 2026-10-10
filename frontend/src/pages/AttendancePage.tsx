import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { api, ApiRequestError } from "#lib/api-client"
import { useAuth } from "#providers/auth-context"
import type { AttendanceRosterEntry, AttendanceStatus, Course, PaginatedResult } from "#lib/types"
import { Button } from "#components/ui/button"
import { Label } from "#components/ui/label"
import { Input } from "#components/ui/input"
import { Card, CardContent } from "#components/ui/card"
import { cn } from "cn"

const statusOptions: { value: AttendanceStatus; label: string; activeClass: string }[] = [
  { value: "present", label: "Present", activeClass: "bg-primary text-primary-foreground" },
  { value: "late", label: "Late", activeClass: "bg-amber-500 text-white" },
  { value: "absent", label: "Absent", activeClass: "bg-destructive text-destructive-foreground" },
]

function getCourseId(course: Course): string {
  const fallbackId = (course as unknown as { _id?: string })._id
  return course.id || fallbackId || ""
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function AttendancePage() {
  const { user, can } = useAuth()
  const queryClient = useQueryClient()
  const canEdit = user?.role === "owner" || can("attendance", "edit")

  const [courseId, setCourseId] = React.useState("")
  const [date, setDate] = React.useState(todayISO())
  const [draft, setDraft] = React.useState<Record<string, AttendanceStatus>>({})

  const { data: courses } = useQuery({
    queryKey: ["courses", "for-attendance"],
    queryFn: () => api.get<PaginatedResult<Course>>("/courses?limit=100"),
  })

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ["attendance-roster", courseId, date],
    queryFn: () =>
      api.get<{ roster: AttendanceRosterEntry[] }>(
        `/attendance?course=${courseId}&date=${date}`
      ),
    enabled: Boolean(courseId && date),
  })

  const save = useMutation({
    mutationFn: () => {
      const records = (data?.roster ?? []).map((entry) => ({
        enrollment: entry.enrollment,
        status: draft[entry.enrollment] ?? entry.status,
      }))
      return api.post("/attendance", {
        course: courseId,
        date,
        records: records.filter((r): r is { enrollment: string; status: AttendanceStatus } =>
          Boolean(r.status)
        ),
      })
    },
    onSuccess: () => {
      toast.success("Attendance saved")
      setDraft({})
      queryClient.invalidateQueries({ queryKey: ["attendance-roster", courseId, date] })
    },
    onError: (err) => {
      toast.error(err instanceof ApiRequestError ? err.message : "Failed to save attendance")
    },
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Attendance</h1>
        <p className="text-sm text-muted-foreground">
          Pick a course and date to mark or review attendance.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-1.5 sm:w-64">
          <Label htmlFor="course">Course</Label>
          <select
            id="course"
            className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            value={courseId}
            onChange={(e) => {
              setCourseId(e.target.value)
              setDraft({})
            }}
          >
            <option value="">Select a course…</option>
            {courses?.items.map((c) => {
              const normalizedId = getCourseId(c)
              return (
                <option key={normalizedId || c.title} value={normalizedId}>
                  {c.title}
                </option>
              )
            })}
          </select>
        </div>
        <div className="flex flex-col gap-1.5 sm:w-48">
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value)
              setDraft({})
            }}
          />
        </div>
        {canEdit && courseId && date && (
          <Button
            className="sm:ml-auto"
            onClick={() => save.mutate()}
            disabled={save.isPending || !data?.roster.length}
          >
            {save.isPending ? "Saving…" : "Save attendance"}
          </Button>
        )}
      </div>

      {!courseId || !date ? (
        <p className="text-sm text-muted-foreground">Select a course and date to see the roster.</p>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Loading roster…</p>
      ) : isError ? (
        <p className="text-sm text-destructive">
          {error instanceof ApiRequestError ? error.message : "Failed to load roster."}
        </p>
      ) : !data?.roster.length ? (
        <p className="text-sm text-muted-foreground">No active students enrolled in this course.</p>
      ) : (
        <Card>
          <CardContent>
            <div className="flex flex-col divide-y divide-border">
              {data.roster.map((entry) => (
                <div
                  key={entry.enrollment}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="text-sm font-medium">
                    {entry.student.firstName} {entry.student.lastName}
                  </p>
                  <div className="flex gap-1.5">
                    {statusOptions.map((opt) => {
                      const effective = draft[entry.enrollment] ?? entry.status
                      const active = effective === opt.value
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={!canEdit}
                          onClick={() =>
                            setDraft((d) => ({ ...d, [entry.enrollment]: opt.value }))
                          }
                          className={cn(
                            "rounded-lg border border-border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                            active ? opt.activeClass : "bg-transparent text-muted-foreground hover:bg-muted"
                          )}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
            {isFetching && !isLoading && (
              <p className="mt-2 text-xs text-muted-foreground">Refreshing…</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
