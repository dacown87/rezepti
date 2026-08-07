import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  BUG_REPORT_SOURCE_AREAS,
  BUG_REPORT_STATUSES,
  BUG_REPORT_TYPES,
} from '../../src/bug-reports.js'

/**
 * Die Bug-Report-Enums existieren zwangslaeufig zweimal: einmal serverseitig in
 * `src/bug-reports.ts` (Validierung) und einmal in `mobile/utils/bug-reporting.ts`
 * (Typen + Admin-UI-Auswahl). Mobile kann `src/` nicht importieren — eigenes
 * npm-Paket, eigener Bundler.
 *
 * Ohne Absicherung faellt eine Erweiterung stumm auseinander: der Server nimmt
 * einen neuen Status an, das Admin-UI kann ihn nicht setzen und die Mobile-Typen
 * kennen ihn nicht. Dieser Test liest die Mobile-Listen aus dem Quelltext und
 * vergleicht sie mit den Server-Konstanten.
 */
const MOBILE_SOURCE = 'mobile/utils/bug-reporting.ts'

function readMobileList(name: string): string[] {
  const source = readFileSync(MOBILE_SOURCE, 'utf-8')
  const match = source.match(new RegExp(`const ${name} = \\[([^\\]]*)\\]`))
  if (!match) {
    throw new Error(`${name} nicht in ${MOBILE_SOURCE} gefunden`)
  }
  return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1])
}

describe('bug report enums — server/mobile contract', () => {
  it.each([
    ['BUG_REPORT_TYPES', BUG_REPORT_TYPES],
    ['BUG_REPORT_STATUSES', BUG_REPORT_STATUSES],
    ['BUG_REPORT_SOURCE_AREAS', BUG_REPORT_SOURCE_AREAS],
  ])('%s matches the mobile copy', (name, serverValues) => {
    expect(readMobileList(name)).toEqual([...serverValues])
  })
})
