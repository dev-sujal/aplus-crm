import * as React from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react"
import { api, ApiRequestError } from "#lib/api-client"
import { PERMISSION_MODULES, type AuthUser } from "#lib/types"
import { Button } from "#components/ui/button"
import { Input } from "#components/ui/input"
import { Label } from "#components/ui/label"
import { Checkbox } from "#components/ui/checkbox"
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

const permissionShape = z.object({ view: z.boolean(), edit: z.boolean() })
const createAdminSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
  permissions: z.object(
    Object.fromEntries(PERMISSION_MODULES.map((m) => [m, permissionShape])) as Record<
      (typeof PERMISSION_MODULES)[number],
      typeof permissionShape
    >
  ),
})
type CreateAdminValues = z.infer<typeof createAdminSchema>

const emptyPermissions = Object.fromEntries(
  PERMISSION_MODULES.map((m) => [m, { view: false, edit: false }])
) as CreateAdminValues["permissions"]

function getAdminId(admin: AuthUser): string {
  const fallbackId = (admin as unknown as { _id?: string })._id
  return admin.id || fallbackId || ""
}

function PasswordCell({ adminId }: { adminId: string }) {
  const [revealed, setRevealed] = React.useState(false)

  const { data, isFetching, error } = useQuery({
    queryKey: ["admin-password", adminId],
    queryFn: () => api.get<{ password: string }>(`/users/${adminId}/password`),
    enabled: revealed,
    staleTime: 60_000,
  })

  return (
    <div className="flex items-center gap-1.5">
      <code className="min-w-24 rounded-md bg-muted px-2 py-1 text-xs">
        {!revealed
          ? "••••••••"
          : isFetching
            ? "Loading…"
            : error
              ? "Unavailable"
              : data?.password}
      </code>
      <Button
        variant="ghost"
        size="icon"
        aria-label={revealed ? "Hide password" : "Show password"}
        onClick={() => setRevealed((r) => !r)}
      >
        {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </Button>
    </div>
  )
}

export default function UsersPage() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = React.useState(false)

  const { data: admins, isLoading } = useQuery({
    queryKey: ["admins"],
    queryFn: () => api.get<AuthUser[]>("/users"),
  })

  const createAdmin = useMutation({
    mutationFn: (values: CreateAdminValues) => api.post("/users", values),
    onSuccess: () => {
      toast.success("Admin created")
      queryClient.invalidateQueries({ queryKey: ["admins"] })
      setDialogOpen(false)
    },
    onError: (err) => {
      toast.error(err instanceof ApiRequestError ? err.message : "Failed to create admin")
    },
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "disabled" }) =>
      api.patch(`/users/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admins"] }),
    onError: () => toast.error("Failed to update status"),
  })

  const deleteAdmin = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      toast.success("Admin removed")
      queryClient.invalidateQueries({ queryKey: ["admins"] })
    },
    onError: () => toast.error("Failed to remove admin"),
  })

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateAdminValues>({
    resolver: zodResolver(createAdminSchema),
    defaultValues: { firstName: "", lastName: "", email: "", password: "", permissions: emptyPermissions },
  })

  const onSubmit = async (values: CreateAdminValues) => {
    await createAdmin.mutateAsync(values)
    reset()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground">
            Admins you've created, and the modules each one can access.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button><Plus className="size-4" /> Add admin</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add admin</DialogTitle>
              <DialogDescription>
                Set a temporary password and choose which modules they can view or edit.
              </DialogDescription>
            </DialogHeader>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
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
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register("email")} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Temporary password</Label>
                <Input id="password" type="password" {...register("password")} />
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label>Module permissions</Label>
                <div className="rounded-lg border border-border">
                  <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
                    <span>Module</span>
                    <span className="w-10 text-center">View</span>
                    <span className="w-10 text-center">Edit</span>
                  </div>
                  {PERMISSION_MODULES.map((mod) => (
                    <div
                      key={mod}
                      className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-3 py-2 text-sm capitalize last:rounded-b-lg odd:bg-muted/40"
                    >
                      <span>{mod}</span>
                      <Controller
                        control={control}
                        name={`permissions.${mod}.view`}
                        render={({ field }) => (
                          <div className="flex w-10 justify-center">
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                            />
                          </div>
                        )}
                      />
                      <Controller
                        control={control}
                        name={`permissions.${mod}.edit`}
                        render={({ field }) => (
                          <div className="flex w-10 justify-center">
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                            />
                          </div>
                        )}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={isSubmitting || createAdmin.isPending}>
                  {createAdmin.isPending ? "Creating…" : "Create admin"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Admins</CardTitle>
          <CardDescription>{admins?.length ?? 0} admin account(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !admins?.length ? (
            <p className="text-sm text-muted-foreground">No admins yet. Add one to get started.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {admins.map((admin) => (
                <div
                  key={getAdminId(admin)}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {admin.firstName} {admin.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">{admin.email}</p>
                  </div>
                  <PasswordCell adminId={getAdminId(admin)} />
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-xs font-medium " +
                        (admin.status === "active"
                          ? "bg-primary/10 text-primary"
                          : "bg-destructive/10 text-destructive")
                      }
                    >
                      {admin.status}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateStatus.mutate({
                          id: getAdminId(admin),
                          status: admin.status === "active" ? "disabled" : "active",
                        })
                      }
                    >
                      {admin.status === "active" ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      aria-label="Delete admin"
                      onClick={() => {
                        if (confirm(`Remove ${admin.firstName} ${admin.lastName}?`)) {
                          deleteAdmin.mutate(getAdminId(admin))
                        }
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
