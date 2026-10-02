import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ChartColumn, Trophy, TrendingUp, Users, ArrowLeft } from "lucide-react"
import { testsApi } from "#lib/tests-api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#components/ui/card"
import { Button } from "#components/ui/button"

export default function TestAnalyticsPage() {
  const overview = useQuery({ queryKey: ["tests-analytics-overview"], queryFn: () => testsApi.analyticsOverview() })
  const leaderboard = useQuery({ queryKey: ["tests-leaderboard"], queryFn: () => testsApi.leaderboard() })
  const courseComparison = useQuery({ queryKey: ["tests-course-comparison"], queryFn: () => testsApi.courseComparison() })

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
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <p className="text-sm text-muted-foreground">Overview cards, trends, and leaderboard.</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">Tests</p><p className="text-2xl font-semibold">{overview.data?.tests ?? 0}</p></div><ChartColumn className="size-5 text-muted-foreground" /></CardContent></Card>
        <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">Assignments</p><p className="text-2xl font-semibold">{overview.data?.assignments ?? 0}</p></div><Users className="size-5 text-muted-foreground" /></CardContent></Card>
        <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">Average pass rate</p><p className="text-2xl font-semibold">{overview.data?.averageTestPassRate ?? 0}%</p></div><TrendingUp className="size-5 text-muted-foreground" /></CardContent></Card>
        <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">Top students</p><p className="text-2xl font-semibold">{overview.data?.topStudents.length ?? 0}</p></div><Trophy className="size-5 text-muted-foreground" /></CardContent></Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><ChartColumn className="size-4" /> Summary</CardTitle>
          <CardDescription>{overview.isLoading ? "Loading…" : "Snapshot"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          {overview.isLoading ? "Loading…" : `Tests: ${overview.data?.tests ?? 0} · Attempts: ${overview.data?.attempts ?? 0} · Avg student percentage: ${overview.data?.averageStudentPercentage ?? 0}%`}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <p className="font-medium text-foreground">Leaderboard</p>
              <div className="space-y-2">
                {leaderboard.isLoading ? (
                  <p>Loading…</p>
                ) : leaderboard.data?.length ? (
                  leaderboard.data.slice(0, 5).map((student, index) => (
                    <div key={student.id} className="rounded-lg border border-border p-3 text-foreground">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">#{index + 1} {typeof student.student === "string" ? student.student : `${student.student.firstName} ${student.student.lastName}`}</p>
                        <p className="text-sm">{student.averagePercentage}%</p>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, student.averagePercentage)}%` }} /></div>
                    </div>
                  ))
                ) : (
                  <p>No ranked students yet.</p>
                )}
              </div>
            </div>
            <div className="space-y-3">
              <p className="font-medium text-foreground">Course comparison</p>
              <div className="space-y-2">
                {courseComparison.data?.length ? courseComparison.data.map((row) => (
                  <div key={row.courseId} className="rounded-lg border border-border p-3 text-foreground">
                    <div className="flex items-center justify-between text-sm">
                      <p className="font-medium">{row.title}</p>
                      <p>{row.averagePassRate.toFixed(1)}%</p>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, row.averagePassRate)}%` }} /></div>
                    <p className="mt-2 text-xs text-muted-foreground">{row.tests} tests · {row.attempts} attempts</p>
                  </div>
                )) : <p>No course analytics yet.</p>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}