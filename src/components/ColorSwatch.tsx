'use client'

import { colorToHex, type ArkColor } from '@/lib/ark-parser'
import { ColorSwatch } from '@/components/ui/color-swatch'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

interface ColorSwatchesProps {
  colors: ArkColor[]
}

const REGION_LABELS = ['Body', 'Accent', 'Highlights', 'Stripes', 'Eyes', 'Extra']

export function ColorSwatches({ colors }: ColorSwatchesProps) {
  return (
    <div className="flex gap-1">
      {colors.map((color, i) => {
        const hex = colorToHex(color)
        const label = `Region ${i + 1} – ${REGION_LABELS[i]}: ${color.empty ? 'empty' : hex}`
        return (
          <Tooltip key={i}>
            <TooltipTrigger className="cursor-default">
              <ColorSwatch
                color={color.empty ? undefined : hex}
                size="sm"
              />
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
