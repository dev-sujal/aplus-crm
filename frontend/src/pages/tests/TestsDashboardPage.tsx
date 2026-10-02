import { Link } from "react-router-dom"
import { BookOpen, ChartColumn, ClipboardList, FlaskConical, Users } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#components/ui/card"
import { Button } from "#components/ui/button"

const cards = [
  { to: "/tests/questions", title: "Question Bank", description: "Manage course-wise MCQ questions.", icon: BookOpen },
  { to: "/tests/tests", title: "Tests", description: "Create drafts, publish, and manage test banks.", icon: FlaskConical },
  { to: "/tests/assignments", title: "Assign", description: "Share tests with enrolled students.", icon: Users },
  { to: "/tests/results", title: "Results", description: "Review attempts and detailed answers.", icon: ClipboardList },
  { to: "/tests/analytics", title: "Analytics", description: "Pass rates, trends, charts, and leaderboard.", icon: ChartColumn },
]

export default function TestsDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Tests</h1>
        <p className="text-sm text-muted-foreground">Owner-only MCQ test management and student assessment.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.to}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <card.icon className="size-4" />
                {card.title}
              </CardTitle>
              <CardDescription>{card.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button render={<Link to={card.to}>Open</Link>} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}