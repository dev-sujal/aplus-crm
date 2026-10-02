import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { Share2, Plus, RotateCcw, Ban, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { api, ApiRequestError } from "#lib/api-client"
import { testsApi } from "#lib/tests-api"
import type { PaginatedResult, Student, Test, TestAssignment } from "#lib/types"
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

export default function TestAssignmentsPage() {
  const queryClient = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [testId, setTestId] = React.useState("")
  const [studentIds, setStudentIds] = React.useState<string[]>([])
  const [availabilityStart, setAvailabilityStart] = React.useState("")
  const [availabilityEnd, setAvailabilityEnd] = React.useState("")
  const [attemptsAllowed, setAttemptsAllowed] = React.useState("1")

  const testsQuery = useQuery({
    queryKey: ["tests-assign-tests"],
    queryFn: () => api.get<PaginatedResult<Test>>("/tests?status=published&limit=100"),
  })

  const studentsQuery = useQuery({
    queryKey: ["tests-assign-students"],
    queryFn: () => api.get<PaginatedResult<Student>>("/students?limit=200"),
  })

  const { data, isLoading } = useQuery({
    queryKey: ["tests-assignments"],
    queryFn: () => testsApi.listAssignments(""),
  })

  const saveAssignment = useMutation({
    mutationFn: () => {
      if (!testId) throw new Error("Select a test")
      if (!studentIds.length) throw new Error("Select at least one student")
      return testsApi.assignTest(testId, {
        studentIds,
        availabilityStart: availabilityStart || null,
        availabilityEnd: availabilityEnd || null,
        attemptsAllowed: Number(attemptsAllowed) || 1,
      })
    },
    onSuccess: () => {
      toast.success("Assignments created")
      queryClient.invalidateQueries({ queryKey: ["tests-assignments"] })
      setOpen(false)
    },
    onError: (error) => toast.error(error instanceof ApiRequestError ? error.message : error instanceof Error ? error.message : "Unable to assign test"),
  })

  const revokeAssignment = useMutation({
    mutationFn: (id: string) => testsApi.revokeAssignment(id),
    onSuccess: () => {
      toast.success("Assignment revoked")
      queryClient.invalidateQueries({ queryKey: ["tests-assignments"] })
    },
    onError: () => toast.error("Unable to revoke assignment"),
  })

  const allowRetake = useMutation({
    mutationFn: (id: string) => testsApi.allowRetake(id),
    onSuccess: () => {
      toast.success("Retake enabled")
      queryClient.invalidateQueries({ queryKey: ["tests-assignments"] })
    },
    onError: () => toast.error("Unable to allow retake"),
  })

  function toggleStudent(studentId: string) {
    setStudentIds((current) => (current.includes(studentId) ? current.filter((id) => id !== studentId) : [...current, studentId]))
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
          <h1 className="text-2xl font-semibold">Assignments</h1>
          <p className="text-sm text-muted-foreground">Share tests with enrolled students.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Assign test
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Share2 className="size-4" /> Assignments</CardTitle>
          <CardDescription>{isLoading ? "Loading…" : `${data?.length ?? 0} result(s)`}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !data?.length ? (
            <p className="text-sm text-muted-foreground">No assignments yet.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {data.map((assignment: TestAssignment) => (
                <div key={assignment.id} className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{typeof assignment.test === "string" ? assignment.test : assignment.test.title}</p>
                    <p className="text-xs text-muted-foreground">{typeof assignment.student === "string" ? assignment.student : `${assignment.student.firstName} ${assignment.student.lastName}`}</p>
                    <p className="text-xs text-muted-foreground">{assignment.status} · attempts {assignment.attemptsAllowed}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => allowRetake.mutate(assignment.id)}><RotateCcw className="size-3.5" /> Retake</Button>
                    <Button variant="destructive" size="sm" onClick={() => revokeAssignment.mutate(assignment.id)}><Ban className="size-3.5" /> Revoke</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Assign test</DialogTitle>
            <DialogDescription>Pick a published test and one or more enrolled students.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="grid gap-1.5">
                <Label>Test</Label>
                <select className="flex h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" value={testId} onChange={(e) => setTestId(e.target.value)}>
                  <option value="">Select a test…</option>
                  {testsQuery.data?.items.map((test) => <option key={test.id} value={test.id}>{test.title}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5"><Label>Availability start</Label><Input type="datetime-local" value={availabilityStart} onChange={(e) => setAvailabilityStart(e.target.value)} /></div>
                <div className="grid gap-1.5"><Label>Availability end</Label><Input type="datetime-local" value={availabilityEnd} onChange={(e) => setAvailabilityEnd(e.target.value)} /></div>
                <div className="grid gap-1.5"><Label>Attempts allowed</Label><Input type="number" min={1} value={attemptsAllowed} onChange={(e) => setAttemptsAllowed(e.target.value)} /></div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Students</Label>
                <span className="text-xs text-muted-foreground">{studentIds.length} selected</span>
              </div>
              <div className="max-h-[48vh] overflow-auto rounded-xl border border-border">
                {studentsQuery.data?.items.map((student) => {
                  const selected = studentIds.includes(student.id)
                  return (
                    <button key={student.id} type="button" onClick={() => toggleStudent(student.id)} className={`flex w-full items-center justify-between border-b border-border px-3 py-3 text-left text-sm last:border-b-0 ${selected ? "bg-primary/10" : "hover:bg-muted"}`}>
                      <span>{student.firstName} {student.lastName}</span>
                      <span className="text-xs text-muted-foreground">{student.email}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => saveAssignment.mutate()} disabled={saveAssignment.isPending}>{saveAssignment.isPending ? "Assigning…" : "Assign"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}