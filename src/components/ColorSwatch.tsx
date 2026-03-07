'use client'

import { colorToHex, type ArkColor } from '@/lib/ark-parser'

interface ColorSwatchProps {
  colors: ArkColor[]
}

const REGION_LABELS = ['Body', 'Accent', 'Highlights', 'Stripes', 'Eyes', 'Extra']

export function ColorSwatch({ colors }: ColorSwatchProps) {
  return (
    <div className="flex gap-1">
      {colors.map((color, i) => {
        const hex = colorToHex(color)
        return (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <div
              className="w-6 h-6 rounded-sm border border-black/10 dark:border-white/10"
              style={{ backgroundColor: hex }}
              title={`Region ${i + 1}: ${REGION_LABELS[i] ?? ''} — ${hex}`}
            />
          </div>
        )
      })}
    </div>
  )
}
