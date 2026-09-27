import * as React from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight, Award } from "lucide-react"
import { api } from "#lib/api-client"
import type { PaginatedResult, Student } from "#lib/types"
import { Input } from "#components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#components/ui/card"
import { Button } from "#components/ui/button"

function getStudentId(student: Student): string {
  const fallbackId = (student as unknown as { _id?: string })._id
  return student.id || fallbackId || ""
}

export default function CertificatesPage() {
  const [search, setSearch] = React.useState("")

  const params = new URLSearchParams()
  if (search) params.set("search", search)
  params.set("limit", "100")

  const { data, isLoading } = useQuery({
    queryKey: ["certificates-students", search],
    queryFn: () => api.get<PaginatedResult<Student>>(`/students?${params.toString()}`),
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Certificates</h1>
        <p className="text-sm text-muted-foreground">
          Open a student profile directly in the Certificates tab to issue or download certificates.
        </p>
      </div>

      <Input
        placeholder="Search students by name, email, or phone..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="sm:max-w-md"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Students</CardTitle>
          <CardDescription>
            {isLoading ? "Loading students..." : `${data?.total ?? 0} result(s)`}
          </CardDescription>
        </CardHeader>
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
                      <p className="truncate text-sm font-medium">
                        {student.firstName} {student.lastName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {student.email || student.phone || "No contact info"}
                      </p>
                    </div>
                    {studentId ? (
                      <Button
                        size="sm"
                        render={
                          <Link to={`/students/${studentId}?tab=certificates`}>
                            <Award className="size-3.5" /> Manage certificates <ArrowRight className="size-3.5" />
                          </Link>
                        }
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground">Student ID missing</p>
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
