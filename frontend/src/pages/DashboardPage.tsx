import { useAuth } from "#providers/auth-context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "#components/ui/card"

export default function DashboardPage() {
  const { user } = useAuth()

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
    </div>
  )
}
