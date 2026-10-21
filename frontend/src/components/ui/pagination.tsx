import * as React from "react"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { cn } from "cn"
import { Button } from "#components/ui/button"

type PageItem = number | "ellipsis-start" | "ellipsis-end"

/** 1 … 4 [5] 6 … 20 — always shows first, last and the neighbours of the current page. */
function buildPageItems(page: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)

  const items: PageItem[] = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(totalPages - 1, page + 1)

  if (start > 2) items.push("ellipsis-start")
  for (let p = start; p <= end; p++) items.push(p)
  if (end < totalPages - 1) items.push("ellipsis-end")
  items.push(totalPages)
  return items
}

interface PaginationProps {
  page: number
  totalPages: number
  total: number
  limit: number
  onPageChange: (page: number) => void
  /** Dims the controls while the next page is loading. */
  isFetching?: boolean
  className?: string
}

/**
 * Previous / numbered pages / Next (+ First / Last) controls for server-paginated lists.
 * Renders nothing when everything fits on one page.
 */
export function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  isFetching = false,
  className,
}: PaginationProps) {
  const navRef = React.useRef<HTMLElement>(null)

  if (total === 0 || totalPages <= 1) return null

  const current = Math.min(Math.max(page, 1), totalPages)
  const from = (current - 1) * limit + 1
  const to = Math.min(current * limit, total)

  const go = (next: number) => {
    const target = Math.min(Math.max(next, 1), totalPages)
    if (target === current) return
    onPageChange(target)
    // When the list is long, bring its top back into view so the new page is visible.
    const card = navRef.current?.closest('[data-slot="card"]') ?? navRef.current?.parentElement
    if (card && card.getBoundingClientRect().top < 0) {
      card.scrollIntoView({ block: "start", behavior: "smooth" })
    }
  }

  const atStart = current <= 1
  const atEnd = current >= totalPages

  return (
    <nav
      ref={navRef}
      aria-label="Pagination"
      className={cn(
        "flex flex-col items-center gap-3 pt-2 sm:flex-row sm:justify-between",
        isFetching && "opacity-70",
        className
      )}
    >
      <p className="text-xs text-muted-foreground" aria-live="polite">
        Showing {from}–{to} of {total}
      </p>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="First page"
          disabled={atStart}
          onClick={() => go(1)}
        >
          <ChevronsLeft className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Previous page"
          disabled={atStart}
          onClick={() => go(current - 1)}
        >
          <ChevronLeft className="size-4" /> <span className="hidden sm:inline">Previous</span>
        </Button>

        {/* Numbered pages on wider screens, compact "Page x of y" on phones. */}
        <div className="hidden items-center gap-1 md:flex">
          {buildPageItems(current, totalPages).map((item) =>
            typeof item === "number" ? (
              <Button
                key={item}
                type="button"
                variant={item === current ? "default" : "outline"}
                size="icon-sm"
                aria-label={`Page ${item}`}
                aria-current={item === current ? "page" : undefined}
                onClick={() => go(item)}
              >
                {item}
              </Button>
            ) : (
              <span key={item} className="px-1 text-sm text-muted-foreground" aria-hidden="true">
                …
              </span>
            )
          )}
        </div>
        <span className="px-2 text-sm text-muted-foreground md:hidden">
          Page {current} of {totalPages}
        </span>

        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Next page"
          disabled={atEnd}
          onClick={() => go(current + 1)}
        >
          <span className="hidden sm:inline">Next</span> <ChevronRight className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Last page"
          disabled={atEnd}
          onClick={() => go(totalPages)}
        >
          <ChevronsRight className="size-4" />
        </Button>
      </div>
    </nav>
  )
}
