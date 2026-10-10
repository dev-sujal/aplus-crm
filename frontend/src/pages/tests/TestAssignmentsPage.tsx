import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useSearchParams } from "react-router-dom"
import { Share2, Plus, RotateCcw, Ban, ArrowLeft, Copy } from "lucide-react"
import { toast } from "sonner"
import { api } from "#lib/api-client"
import { testsApi } from "#lib/tests-api"
import {
  errorMessage,
  formatDateTime,
  localInputToIso,
  parseNumber,
  personName,
  refId,
  refTitle,
  shareUrl,
} from "#lib/test-utils"
import type { PaginatedResult, Test, TestAssignment } from "#lib/types"
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

const selectClass = "flex h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // clipboard API needs https/localhost; fall back to a hidden textarea
    const area = document.createElement("textarea")
    area.value = text
    area.style.position = "fixed"
    area.style.opacity = "0"
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand("copy")
    document.body.removeChild(area)
    return ok
  }
}

export default function TestAssignmentsPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  // Arriving from the Tests page ("Assign" button) opens the dialog for that test.
  const [presetTest] = React.useState(() => searchParams.get("test") ?? "")
  const [open, setOpen] = React.useState(Boolean(presetTest))
  const [testId, setTestId] = React.useState(presetTest)
  const [studentIds, setStudentIds] = React.useState<string[]>([])
  const [availabilityStart, setAvailabilityStart] = React.useState("")
  const [availabilityEnd, setAvailabilityEnd] = React.useState("")
  const [attemptsAllowed, setAttemptsAllowed] = React.useState("1")
  const [listTestFilter, setListTestFilter] = React.useState("")

  const testsQuery = useQuery({
    queryKey: ["tests-assign-tests"],
    queryFn: () => api.get<PaginatedResult<Test>>("/tests?status=published&limit=100"),
  })

  // Only students enrolled in the selected test's course can be assigned.
  const studentsQuery = useQuery({
    queryKey: ["tests-assign-students", testId],
    queryFn: () => testsApi.eligibleStudents(testId),
    enabled: Boolean(testId),
  })

  const assignmentsQuery = useQuery({
    queryKey: ["tests-assignments", listTestFilter],
    queryFn: () => testsApi.listAssignments(listTestFilter ? `?test=${listTestFilter}` : ""),
  })

  function openDialog(preselectTestId = "") {
    setTestId(preselectTestId)
    setStudentIds([])
    setAvailabilityStart("")
    setAvailabilityEnd("")
    setAttemptsAllowed("1")
    setOpen(true)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next && searchParams.has("test")) setSearchParams({}, { replace: true })
  }

  const saveAssignment = useMutation({
    mutationFn: () => {
      if (!testId) throw new Error("Select a test")
      if (!studentIds.length) throw new Error("Select at least one student")
      const start = localInputToIso(availabilityStart)
      const end = localInputToIso(availabilityEnd)
      if (start && end && new Date(end) <= new Date(start)) throw new Error("Availability end must be after start")
      return testsApi.assignTest(testId, {
        studentIds,
        availabilityStart: start,
        availabilityEnd: end,
        attemptsAllowed: Math.max(1, Math.floor(parseNumber(attemptsAllowed, 1))),
      })
    },
    onSuccess: (created) => {
      toast.success(`Assigned to ${created.length} student(s)`)
      queryClient.invalidateQueries({ queryKey: ["tests-assignments"] })
      handleOpenChange(false)
    },
    onError: (error) => toast.error(errorMessage(error, "Unable to assign test")),
  })

  const revokeAssignment = useMutation({
    mutationFn: (id: string) => testsApi.revokeAssignment(id),
    onSuccess: () => {
      toast.success("Assignment revoked")
      queryClient.invalidateQueries({ queryKey: ["tests-assignments"] })
    },
    onError: (error) => toast.error(errorMessage(error, "Unable to revoke assignment")),
  })

  const allowRetake = useMutation({
    mutationFn: (id: string) => testsApi.allowRetake(id),
    onSuccess: () => {
      toast.success("Retake enabled")
      queryClient.invalidateQueries({ queryKey: ["tests-assignments"] })
    },
    onError: (error) => toast.error(errorMessage(error, "Unable to allow retake")),
  })

  function toggleStudent(studentId: string) {
    setStudentIds((current) =>
      current.includes(studentId) ? current.filter((id) => id !== studentId) : [...current, studentId]
    )
  }

  async function copyLink(assignment: TestAssignment) {
    const ok = await copyText(shareUrl(assignment.shareToken))
    if (ok) toast.success("Link copied")
    else toast.error("Could not copy. Link: " + shareUrl(assignment.shareToken))
  }

  function confirmRevoke(assignment: TestAssignment) {
    if (window.confirm(`Revoke ${personName(assignment.student)}'s access to "${refTitle(assignment.test)}"?`)) {
      revokeAssignment.mutate(assignment.id)
    }
  }

  const students = studentsQuery.data ?? []
  const assignments = assignmentsQuery.data ?? []
  const allSelected = students.length > 0 && studentIds.length === students.length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to="/tests" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5" /> Back to tests
          </Link>
          <h1 className="text-2xl font-semibold">Assignments</h1>
          <p className="text-sm text-muted-foreground">Share tests with enrolled students.</p>
        </div>
        <Button onClick={() => openDialog()}>
          <Plus className="size-4" /> Assign test
        </Button>
      </div>

      <div className="max-w-xs">
        <select className={`${selectClass} w-full`} value={listTestFilter} onChange={(e) => setListTestFilter(e.target.value)}>
          <option value="">All tests</option>
          {testsQuery.data?.items.map((test) => (
            <option key={test.id} value={test.id}>{test.title}</option>
          ))}
        </select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Share2 className="size-4" /> Assignments</CardTitle>
          <CardDescription>
            {assignmentsQuery.isLoading ? "Loading…" : assignmentsQuery.isError ? "Failed to load" : `${assignments.length} result(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assignmentsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : assignmentsQuery.isError ? (
            <p className="text-sm text-destructive">{errorMessage(assignmentsQuery.error, "Unable to load assignments")}</p>
          ) : !assignments.length ? (
            <p className="text-sm text-muted-foreground">No assignments yet.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {assignments.map((assignment) => (
                <div key={assignment.id} className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{refTitle(assignment.test, "Deleted test")}</p>
                    <p className="text-xs text-muted-foreground">{personName(assignment.student)}</p>
                    <p className="text-xs text-muted-foreground">
                      {assignment.status.replace("_", " ")} · attempts allowed {assignment.attemptsAllowed} · window {formatDateTime(assignment.availabilityStart)} → {formatDateTime(assignment.availabilityEnd)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => copyLink(assignment)} disabled={assignment.status === "revoked"}>
                      <Copy className="size-3.5" /> Copy link
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => allowRetake.mutate(assignment.id)} disabled={allowRetake.isPending || assignment.status === "revoked"}>
                      <RotateCcw className="size-3.5" /> Retake
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => confirmRevoke(assignment)} disabled={revokeAssignment.isPending || assignment.status === "revoked"}>
                      <Ban className="size-3.5" /> {assignment.status === "revoked" ? "Revoked" : "Revoke"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign test</DialogTitle>
            <DialogDescription>Pick a published test, then choose from the students enrolled in its course.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="grid gap-1.5">
                <Label>Test</Label>
                <select
                  className={selectClass}
                  value={testId}
                  onChange={(e) => {
                    setTestId(e.target.value)
                    setStudentIds([]) // students depend on the test's course
                  }}
                >
                  <option value="">Select a test…</option>
                  {testsQuery.data?.items.map((test) => (
                    <option key={test.id} value={test.id}>{test.title} — {refTitle(test.course)}</option>
                  ))}
                </select>
                {testsQuery.isSuccess && !testsQuery.data.items.length && (
                  <p className="text-xs text-muted-foreground">No published tests. Publish a test first (Tests page).</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5"><Label>Available from</Label><Input type="datetime-local" value={availabilityStart} onChange={(e) => setAvailabilityStart(e.target.value)} /></div>
                <div className="grid gap-1.5"><Label>Available until</Label><Input type="datetime-local" value={availabilityEnd} onChange={(e) => setAvailabilityEnd(e.target.value)} /></div>
                <div className="grid gap-1.5"><Label>Attempts allowed</Label><Input type="number" min={1} value={attemptsAllowed} onChange={(e) => setAttemptsAllowed(e.target.value)} /></div>
              </div>
              <p className="text-xs text-muted-foreground">Leave the dates empty for an always-open link.</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Students</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{studentIds.length} selected</span>
                  {students.length > 0 && (
                    <Button type="button" variant="ghost" size="xs" onClick={() => setStudentIds(allSelected ? [] : students.map((student) => student.id))}>
                      {allSelected ? "Clear" : "Select all"}
                    </Button>
                  )}
                </div>
              </div>
              <div className="max-h-[48vh] overflow-auto rounded-xl border border-border">
                {!testId ? (
                  <p className="p-3 text-sm text-muted-foreground">Select a test to see its enrolled students.</p>
                ) : studentsQuery.isLoading ? (
                  <p className="p-3 text-sm text-muted-foreground">Loading students…</p>
                ) : studentsQuery.isError ? (
                  <p className="p-3 text-sm text-destructive">{errorMessage(studentsQuery.error, "Unable to load students")}</p>
                ) : !students.length ? (
                  <p className="p-3 text-sm text-muted-foreground">No students are enrolled in this test's course. Enroll students from the Students page first.</p>
                ) : (
                  students.map((student) => {
                    const id = refId(student)
                    const selected = studentIds.includes(id)
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggleStudent(id)}
                        className={`flex w-full items-center justify-between gap-3 border-b border-border px-3 py-3 text-left text-sm last:border-b-0 ${selected ? "bg-primary/10" : "hover:bg-muted"}`}
                      >
                        <span className="flex items-center gap-2">
                          <input type="checkbox" readOnly checked={selected} tabIndex={-1} />
                          {student.firstName} {student.lastName}
                        </span>
                        <span className="text-xs text-muted-foreground">{student.email || student.phone}</span>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
            <Button onClick={() => saveAssignment.mutate()} disabled={saveAssignment.isPending || !testId || !studentIds.length}>
              {saveAssignment.isPending ? "Assigning…" : `Assign${studentIds.length ? ` (${studentIds.length})` : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
