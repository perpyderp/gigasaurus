'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Popover, PopoverContent, PopoverDescription, PopoverTitle } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { useAsRef } from '@/hooks/use-as-ref'
import type { TourController } from './use-tour'

export interface TourStep {
  /** `data-tour` value of the element to point at. Without one (or if it isn't on the page), the step shows centered. */
  target?: string
  title: string
  body: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  /** Runs before the target is looked up, e.g. to open the panel the step is about. */
  onEnter?: () => void
}

/** How long to wait for a target that appears after `onEnter` (a panel opening). */
const TARGET_WAIT_MS = 300
const SPOT_PADDING = 6
/** A target taller than this share of the screen leaves no room beside it; the popover goes above its top edge instead. */
const TALL = 0.45

/**
 * A guided tour: dims the page, outlines each step's element and explains it
 * in a popover beside it. Arrow keys step through; Escape ends it.
 *
 *   const tour = useTour('my-page', { autoStart: true })
 *   <Button onClick={tour.actions.start}>Take the tour</Button>
 *   <Tour tour={tour} steps={steps} label="My page tour" />
 *
 * Mark elements with `data-tour="name"` and point steps at them.
 */
export function Tour({ tour, steps, label }: { tour: TourController; steps: TourStep[]; label: string }) {
  // Mounted only while open, so every run starts from a clean slate.
  return tour.state.open && steps.length > 0 ? <TourRun tour={tour} steps={steps} label={label} /> : null
}

/** The step being shown and the element it points at (null = centered). */
interface Shown {
  index: number
  el: Element | null
  tall: boolean
}

function TourRun({ tour, steps, label }: { tour: TourController; steps: TourStep[]; label: string }) {
  const { index } = tour.state
  const { goTo, close } = tour.actions
  // Steps often close over page setters and get rebuilt each render; read the latest
  // without re-running the step's onEnter every time they change.
  const stepsRef = useAsRef(steps)
  const [shown, setShown] = useState<Shown | null>(null)
  const [spot, setSpot] = useState<{ el: Element; rect: DOMRect } | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  // Enter the step, then wait (briefly) for its element to exist.
  useEffect(() => {
    const step = stepsRef.current[index]
    if (!step) return
    step.onEnter?.()
    const selector = step.target ? `[data-tour="${CSS.escape(step.target)}"]` : null
    // Only a step that opens something has a reason to wait; otherwise a missing element stays missing.
    const deadline = performance.now() + (step.onEnter ? TARGET_WAIT_MS : 0)
    let frame = 0
    const find = () => {
      const el = selector ? document.querySelector(selector) : null
      if (selector && !el && performance.now() < deadline) {
        frame = requestAnimationFrame(find)
        return
      }
      const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
      const top = el?.getBoundingClientRect().top ?? 0
      const tall = !!el && el.getBoundingClientRect().height > window.innerHeight * TALL
      setShown({ index, el, tall })
      // Tall targets start just past the middle, leaving room for the popover over their top edge.
      if (tall) window.scrollBy({ top: top - window.innerHeight * 0.55, behavior })
      else el?.scrollIntoView({ block: 'center', behavior })
    }
    frame = requestAnimationFrame(find)
    return () => cancelAnimationFrame(frame)
  }, [index, stepsRef])

  // Follow the element as the page scrolls, resizes or reflows.
  const el = shown?.el ?? null
  useEffect(() => {
    if (!el) return
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setSpot({ el, rect: el.getBoundingClientRect() }))
    }
    update()
    const resize = new ResizeObserver(update)
    resize.observe(el)
    window.addEventListener('scroll', update, { capture: true, passive: true })
    window.addEventListener('resize', update, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      window.removeEventListener('scroll', update, { capture: true })
      window.removeEventListener('resize', update)
    }
  }, [el])

  // Move focus to each new step so screen readers announce it. Without preventScroll the
  // browser jumps to the popover and cuts the scroll to the target short.
  useEffect(() => {
    if (shown) popupRef.current?.focus({ preventScroll: true })
  }, [shown])

  const anchor = useMemo(() => (el ? (shown?.tall ? topEdgeOf(el) : el) : centerOfViewport), [el, shown?.tall])

  if (!shown) return null
  const step = steps[shown.index] ?? steps[0]
  const rect = spot && spot.el === shown.el ? spot.rect : null
  const last = shown.index === steps.length - 1
  const next = () => (last ? close() : goTo(shown.index + 1))
  const back = () => shown.index > 0 && goTo(shown.index - 1)

  return (
    <>
      {createPortal(
        // Blocks the page while the tour runs; the outline sits over the element being explained.
        <div aria-hidden className="fixed inset-0 z-40">
          {rect ? (
            <div
              className="pointer-events-none absolute top-0 left-0 rounded-lg motion-safe:transition-transform motion-safe:duration-300"
              style={{
                transform: `translate(${rect.left - SPOT_PADDING}px, ${rect.top - SPOT_PADDING}px)`,
                width: rect.width + SPOT_PADDING * 2,
                height: rect.height + SPOT_PADDING * 2,
                // Outline, then the dimming. One box-shadow, since Tailwind's ring would be overwritten by it.
                boxShadow: '0 0 0 2px var(--primary), 0 0 0 9999px rgb(0 0 0 / 0.55)',
              }}
            />
          ) : (
            <div className="absolute inset-0 bg-black/55" />
          )}
        </div>,
        document.body,
      )}
      <Popover
        open
        modal="trap-focus"
        onOpenChange={(open, details) => {
          // The dimmed page isn't a way out; Escape and "Skip tour" are.
          if (!open && details.reason === 'escape-key') close()
        }}
      >
        <PopoverContent
          ref={popupRef}
          tabIndex={-1}
          // Start on the dialog itself, not "Skip tour", so the first thing read is the step.
          initialFocus={popupRef}
          anchor={anchor}
          // Fixed, like the overlay: a centered step has no element to follow, so it mustn't scroll with the page.
          positionMethod="fixed"
          side={!shown.el ? 'bottom' : shown.tall ? 'top' : (step.side ?? 'bottom')}
          sideOffset={shown.el ? SPOT_PADDING + 10 : 0}
          // Keep clear of the sticky site header (3.5rem) as well as the screen edges.
          collisionPadding={{ top: 72, right: 16, bottom: 16, left: 16 }}
          className="w-[min(24rem,calc(100vw-2rem))] gap-3 p-5 outline-none"
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') next()
            if (e.key === 'ArrowLeft') back()
          }}
        >
          {/* The step title names the dialog; this says which tour and where in it. */}
          <p className="text-muted-foreground text-xs tabular-nums">
            <span className="sr-only">{label}, step </span>
            {shown.index + 1} of {steps.length}
          </p>
          <PopoverTitle className="font-display text-xl leading-tight font-normal">{step.title}</PopoverTitle>
          <PopoverDescription render={<div />} className="text-muted-foreground space-y-2 text-[15px] leading-relaxed">
            {step.body}
          </PopoverDescription>
          <div className="mt-1 flex items-center gap-2">
            {!last && (
              <Button variant="ghost" size="sm" onClick={close}>
                Skip tour
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              {shown.index > 0 && (
                <Button variant="outline" size="sm" onClick={back}>
                  Back
                </Button>
              )}
              <Button size="sm" onClick={next}>
                {last ? 'Finish' : 'Next'}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  )
}

/** The top edge of a tall element, so the popover sits just above it rather than off screen. */
function topEdgeOf(el: Element) {
  return {
    contextElement: el,
    getBoundingClientRect: () => {
      const r = el.getBoundingClientRect()
      return DOMRect.fromRect({ x: r.x, y: r.y, width: r.width, height: 0 })
    },
  }
}

/** Steps without an element sit a little above the middle of the screen. */
const centerOfViewport = {
  getBoundingClientRect: () => DOMRect.fromRect({ x: window.innerWidth / 2, y: window.innerHeight * 0.3, width: 0, height: 0 }),
}
