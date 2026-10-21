import { useQuery } from "@tanstack/react-query"
import { FlaskConical } from "lucide-react"
import { useAuth } from "#providers/auth-context"
import { testsApi } from "#lib/tests-api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "#components/ui/card"

export default function DashboardPage() {
  const { user } = useAuth()
  const testsOverview = useQuery({
    queryKey: ["tests-dashboard-overview"],
    queryFn: () => testsApi.analyticsOverview(),
    enabled: user?.role === "owner",
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome back, {user?.firstName}</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as <span className="capitalize">{user?.role}</span>. Course, student,
          attendance, fee and certificate widgets will land here as those modules are built.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your access</CardTitle>
          <CardDescription>Modules you can view or edit.</CardDescription>
        </CardHeader>
        <CardContent>
          {user?.role === "owner" ? (
            <p className="text-sm text-muted-foreground">
              As Owner you have full access to every module.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              {Object.entries(user?.permissions ?? {}).map(([mod, perm]) => (
                <li
                  key={mod}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 capitalize"
                >
                  <span>{mod}</span>
                  <span className="text-xs text-muted-foreground">
                    {perm.view ? "View" : ""}
                    {perm.view && perm.edit ? " · " : ""}
                    {perm.edit ? "Edit" : ""}
                    {!perm.view && !perm.edit ? "None" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {user?.role === "owner" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><FlaskConical className="size-4" /> Tests summary</CardTitle>
            <CardDescription>Quick glance at the new MCQ system.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <SummaryStat label="Tests" value={testsOverview.data?.tests ?? 0} loading={testsOverview.isLoading} />
            <SummaryStat label="Assignments" value={testsOverview.data?.assignments ?? 0} loading={testsOverview.isLoading} />
            <SummaryStat label="Attempts" value={testsOverview.data?.attempts ?? 0} loading={testsOverview.isLoading} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function SummaryStat({ label, value, loading }: { label: string; value: number; loading: boolean }) {
  return (
    <div className="rounded-xl border border-border px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{loading ? "…" : value}</p>
    </div>
  )
}
