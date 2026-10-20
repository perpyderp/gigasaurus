'use client'

import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

/** Page buttons (a window of five), a "showing x–y" summary and a page-size picker. */
export function CreaturePagination({
  page,
  totalPages,
  pageSize,
  pageSizeOptions,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number
  totalPages: number
  pageSize: number
  pageSizeOptions: number[]
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}) {
  const first = Math.max(1, Math.min(totalPages - 4, page - 2))

  return (
    <nav aria-label="Pagination" className="flex flex-col items-center justify-between gap-4 pt-2 sm:flex-row">
      <div className="text-muted-foreground text-sm">
        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="size-9 p-0"
            aria-label="Previous page"
          >
            <IconChevronLeft size={16} />
          </Button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const p = first + i
            return (
              <Button
                key={p}
                variant={p === page ? 'default' : 'outline'}
                size="sm"
                onClick={() => onPageChange(p)}
                aria-current={p === page ? 'page' : undefined}
                className="size-9 p-0 text-sm tabular-nums"
              >
                {p}
              </Button>
            )
          })}
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="size-9 p-0"
            aria-label="Next page"
          >
            <IconChevronRight size={16} />
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-sm">Per page</span>
        <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
          <SelectTrigger className="h-9 w-18 text-sm" aria-label="Creatures per page">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((n) => (
              <SelectItem key={n} value={String(n)}>{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </nav>
  )
}
