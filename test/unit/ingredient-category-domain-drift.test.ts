import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * `src/ingredient-category-domain.ts` und `mobile/utils/ingredient-category-domain.ts`
 * sind bewusst zwei Kopien derselben Domaenenlogik.
 *
 * Warum kein geteiltes Modul: `mobile/` ist ein eigenstaendiges npm-Paket mit
 * eigenem Bundler (Metro) und eigenem tsconfig, und die Docker-Stage
 * `web-builder` kopiert ausschliesslich `mobile/` (siehe Dockerfile). Ein
 * gemeinsames `shared/` braeuchte Metro-`watchFolders`, Pfad-Aliase in beiden
 * tsconfigs und eine zusaetzliche COPY-Zeile — spuerbares Risiko fuer den
 * Expo-Export und die Perf-Gates, fuer ~170 Zeilen abhaengigkeitsfreier Logik.
 *
 * Statt zu teilen, wird die Kopie erzwungen: divergiert eine Seite, faellt
 * dieser Test. Wenn die beiden Seiten irgendwann *wirklich* auseinanderlaufen
 * sollen, ist das eine bewusste Entscheidung — dann diesen Test loeschen und
 * die Begruendung dokumentieren, statt ihn stillschweigend zu umgehen.
 */
describe('ingredient/category domain — drift guard', () => {
  const server = 'src/ingredient-category-domain.ts'
  const mobile = 'mobile/utils/ingredient-category-domain.ts'

  it('keeps the server and mobile copies byte-identical', () => {
    const serverSource = readFileSync(server, 'utf-8')
    const mobileSource = readFileSync(mobile, 'utf-8')

    if (serverSource !== mobileSource) {
      throw new Error(
        `${server} und ${mobile} sind auseinandergelaufen.\n` +
          `Aenderungen muessen in beide Dateien — abgleichen mit:\n` +
          `  diff ${server} ${mobile}\n` +
          `  cp ${server} ${mobile}`,
      )
    }

    expect(mobileSource).toBe(serverSource)
  })

  it('exports only the surface both sides consume', () => {
    const exported = [...readFileSync(server, 'utf-8').matchAll(/^export (?:function|const|interface) (\w+)/gm)]
      .map((m) => m[1])
      .sort()

    expect(exported).toEqual([
      'CATEGORY_KEYWORDS',
      'CategoryKeywordRule',
      'IngredientSearchEvaluation',
      'detectCategory',
      'evaluateIngredientSearch',
      'recipeMatchesCategory',
    ])
  })
})
