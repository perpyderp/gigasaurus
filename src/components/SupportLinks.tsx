import { Coffee, MessageSquarePlus } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button-variants'
import { FEEDBACK_URL, KOFI_URL } from '@/lib/links'

/** Ko-fi tip link. A plain link rather than Ko-fi's widget script, which needs document.write. */
export function KofiButton({ className }: { className?: string }) {
  return (
    <a href={KOFI_URL} target="_blank" rel="noreferrer" className={buttonVariants({ variant: 'outline', className })}>
      <Coffee aria-hidden /> Support on Ko-fi
    </a>
  )
}

/** Opens the GitHub issue picker: bug report, suggestion or data correction. */
export function FeedbackButton({ className }: { className?: string }) {
  return (
    <a href={FEEDBACK_URL} target="_blank" rel="noreferrer" className={buttonVariants({ variant: 'outline', className })}>
      <MessageSquarePlus aria-hidden /> Suggest or report
    </a>
  )
}
