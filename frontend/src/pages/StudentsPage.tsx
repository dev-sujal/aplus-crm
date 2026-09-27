import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Link } from "react-router-dom"
import { Plus, Trash2 } from "lucide-react"
import { api, ApiRequestError } from "#lib/api-client"
import { useAuth } from "#providers/auth-context"
import type { PaginatedResult, Student } from "#lib/types"
import { Button } from "#components/ui/button"
import { Input } from "#components/ui/input"
import { Label } from "#components/ui/label"
import { Card, CardContent } from "#components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "#components/ui/dialog"

const studentSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")).default(""),
  phone: z.string().optional().default(""),
  address: z.string().optional().default(""),
  guardianContact: z.string().optional().default(""),
  dob: z.string().optional().default(""),
  gender: z.enum(["male", "female", "other", ""]).default(""),
})
type StudentFormInput = z.input<typeof studentSchema>
type StudentFormValues = z.output<typeof studentSchema>

const emptyForm: StudentFormInput = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  guardianContact: "",
  dob: "",
  gender: "",
}

function getStudentId(student: Student): string {
  const fallbackId = (student as unknown as { _id?: string })._id
  return student.id || fallbackId || ""
}

export default function StudentsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = React.useState("")
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingStudent, setEditingStudent] = React.useState<Student | null>(null)

  const canMutate = user?.role === "owner"

  const params = new URLSearchParams()
  if (search) params.set("search", search)

  const { data, isLoading } = useQuery({
    queryKey: ["students", search],
    queryFn: () => api.get<PaginatedResult<Student>>(`/students?${params.toString()}`),
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StudentFormInput, unknown, StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: emptyForm,
  })

  const openCreate = () => {
    setEditingStudent(null)
    reset(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (student: Student) => {
    setEditingStudent(student)
    reset({
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      phone: student.phone,
      address: student.address,
      guardianContact: student.guardianContact,
      dob: student.dob ? student.dob.slice(0, 10) : "",
      gender: student.gender,
    })
    setDialogOpen(true)
  }

  const saveStudent = useMutation({
    mutationFn: (values: StudentFormValues) => {
      const payload = { ...values, dob: values.dob || null }
      return editingStudent
        ? api.patch(`/students/${editingStudent.id}`, payload)
        : api.post("/students", payload)
    },
    onSuccess: () => {
      toast.success(editingStudent ? "Student updated" : "Student registered")
      queryClient.invalidateQueries({ queryKey: ["students"] })
      setDialogOpen(false)
    },
    onError: (err) => {
      toast.error(err instanceof ApiRequestError ? err.message : "Failed to save student")
    },
  })

  const deleteStudent = useMutation({
    mutationFn: (id: string) => api.delete(`/students/${id}`),
    onSuccess: () => {
      toast.success("Student removed")
      queryClient.invalidateQueries({ queryKey: ["students"] })
    },
    onError: () => toast.error("Failed to remove student"),
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold">Students</h1>
          <p className="text-sm text-muted-foreground">
            {data?.total ?? 0} student{data?.total === 1 ? "" : "s"}
          </p>
        </div>
        {canMutate && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger
              render={
                <Button onClick={openCreate}>
                  <Plus className="size-4" /> Register student
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingStudent ? "Edit student" : "Register student"}</DialogTitle>
                <DialogDescription>
                  Basic details. Course enrollment is managed from the student's profile.
                </DialogDescription>
              </DialogHeader>
              <form
                className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1"
                onSubmit={handleSubmit((values) => saveStudent.mutate(values))}
                noValidate
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="firstName">First name</Label>
                    <Input id="firstName" {...register("firstName")} />
                    {errors.firstName && (
                      <p className="text-xs text-destructive">{errors.firstName.message}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="lastName">Last name</Label>
                    <Input id="lastName" {...register("lastName")} />
                    {errors.lastName && (
                      <p className="text-xs text-destructive">{errors.lastName.message}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" {...register("email")} />
                    {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" {...register("phone")} />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" {...register("address")} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="dob">Date of birth</Label>
                    <Input id="dob" type="date" {...register("dob")} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="gender">Gender</Label>
                    <select
                      id="gender"
                      className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                      {...register("gender")}
                    >
                      <option value="">Prefer not to say</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="guardianContact">Guardian contact</Label>
                  <Input id="guardianContact" {...register("guardianContact")} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isSubmitting || saveStudent.isPending}>
                    {saveStudent.isPending
                      ? "Saving…"
                      : editingStudent
                        ? "Save changes"
                        : "Register student"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Input
        placeholder="Search students…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="sm:max-w-xs"
      />

      <Card>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !data?.items.length ? (
            <p className="text-sm text-muted-foreground">No students found.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {data.items.map((student) => {
                const studentId = getStudentId(student)
                return (
                  <div
                    key={studentId || `${student.firstName}-${student.lastName}-${student.email}`}
                    className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      {studentId ? (
                        <Link to={`/students/${studentId}`} className="min-w-0">
                          <p className="truncate text-sm font-medium hover:underline">
                            {student.firstName} {student.lastName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {student.email || student.phone || "No contact info"}
                          </p>
                        </Link>
                      ) : (
                        <>
                          <p className="truncate text-sm font-medium">
                            {student.firstName} {student.lastName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">Student ID missing</p>
                        </>
                      )}
                    </div>
                    {canMutate && (
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(student)}>
                          Edit
                        </Button>
                        {studentId && (
                          <Button
                            variant="destructive"
                            size="icon"
                            aria-label="Delete student"
                            onClick={() => {
                              if (confirm(`Remove ${student.firstName} ${student.lastName}?`)) {
                                deleteStudent.mutate(studentId)
                              }
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
