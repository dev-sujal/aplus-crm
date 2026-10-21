import * as React from "react"

/**
 * Current page for a paginated list. Falls back to page 1 whenever `resetKey`
 * changes (pass every filter/search value that affects the result set).
 *
 * The stored page is reset during render (React's documented "adjust state when
 * a value changes" pattern) rather than in an effect, so there is never a render
 * with a stale page + new filters, and no extra request. The stored state is
 * overwritten, not just ignored, so returning to an earlier filter value (e.g.
 * clearing a search box) starts from page 1 again instead of resurrecting the
 * page that was open before.
 */
export function usePage(resetKey: string): [number, (page: number) => void] {
  const [state, setState] = React.useState({ key: resetKey, page: 1 })

  if (state.key !== resetKey) {
    setState({ key: resetKey, page: 1 })
  }

  const page = state.key === resetKey ? state.page : 1
  const setPage = React.useCallback(
    (next: number) => setState({ key: resetKey, page: Math.max(1, Math.floor(next)) }),
    [resetKey]
  )
  return [page, setPage]
}

/**
 * If the current page no longer exists (e.g. the last item on the last page was
 * deleted), step back to the last page that does. Pass `ready=false` while the
 * data is a placeholder from a previous query so we never clamp on stale data.
 */
export function useClampPage(
  page: number,
  totalPages: number | undefined,
  setPage: (page: number) => void,
  ready = true
) {
  if (ready && totalPages !== undefined && totalPages > 0 && page > totalPages) {
    setPage(totalPages)
  }
}
