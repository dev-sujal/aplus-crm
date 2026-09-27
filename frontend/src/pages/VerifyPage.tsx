import * as React from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { CheckCircle2, Download, Search, XCircle } from "lucide-react"
import { api, API_URL } from "#lib/api-client"
import type { VerifyResult } from "#lib/types"
import { Button } from "#components/ui/button"
import { Input } from "#components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#components/ui/card"

export default function VerifyPage() {
  const { credentialId } = useParams<{ credentialId?: string }>()
  const navigate = useNavigate()
  const [input, setInput] = React.useState(credentialId ?? "")

  const { data, isLoading, isFetched } = useQuery({
    queryKey: ["verify", credentialId],
    queryFn: () => api.get<VerifyResult>(`/verify/${credentialId}`, { skipAuthRetry: true }),
    enabled: Boolean(credentialId),
  })

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim()) navigate(`/verify/${input.trim()}`)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Verify a certificate</CardTitle>
          <CardDescription>Enter the credential ID printed on the certificate.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form className="flex gap-2" onSubmit={onSubmit}>
            <Input
              placeholder="e.g. CC-2026-0001"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <Button type="submit" size="icon" aria-label="Verify">
              <Search className="size-4" />
            </Button>
          </form>

          {isLoading && <p className="text-sm text-muted-foreground">Checking…</p>}

          {isFetched && data?.valid && (
            <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2 text-primary">
                <CheckCircle2 className="size-5" />
                <p className="font-semibold">Valid certificate</p>
              </div>
              <dl className="grid grid-cols-1 gap-2 text-sm">
                <Row label="Student" value={data.studentName} />
                <Row label="Course" value={data.courseName} />
                <Row label="Issuing centre" value={data.issuingCentre} />
                <Row
                  label="Issue date"
                  value={data.issueDate ? data.issueDate.slice(0, 10) : undefined}
                />
                <Row label="Credential ID" value={data.credentialId} />
              </dl>
              <Button
                className="mt-1 w-full"
                render={
                  <a
                    href={`${API_URL}/certificates/${data.credentialId}/download`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Download className="size-4" /> Download certificate
                  </a>
                }
              />
            </div>
          )}

          {isFetched && data && !data.valid && (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-destructive">
              <XCircle className="size-5" />
              <p className="text-sm font-medium">
                {data.message ?? "No certificate found for this ID."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}
