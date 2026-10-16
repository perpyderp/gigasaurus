import { readFileSync } from 'fs'
import { join } from 'path'
import {
  normalizeBlueprintPath,
  type AseSpeciesEntry,
  type AseSpeciesFile,
} from '@/lib/ark-stat-solver/ase-data'

const DATA_PATH = join(process.cwd(), 'data', 'ase-species.json')

let cache: AseSpeciesFile | null = null

function getData(): AseSpeciesFile | null {
  if (cache) return cache
  try {
    cache = JSON.parse(readFileSync(DATA_PATH, 'utf-8')) as AseSpeciesFile
  } catch {
    return null
  }
  return cache
}

/**
 * Species stat data extracted from ARKStatsExtractor (data/ase-species.json).
 * Looked up by the export's DinoClass blueprint path.
 */
export abstract class AseSpeciesService {
  static byBlueprint(dinoClass: string): AseSpeciesEntry | null {
    const data = getData()
    if (!data) return null
    let key = normalizeBlueprintPath(dinoClass)
    key = data.remaps[key] ?? key
    return data.species[key] ?? null
  }
}
