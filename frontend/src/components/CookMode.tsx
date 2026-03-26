import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, X, CheckSquare, Square, AlertCircle, ChevronUp, ListChecks } from 'lucide-react'
import { getRecipe } from '../api/services.js'
import type { Recipe } from '../api/types.js'
import { scaleIngredient } from '../utils/scaling.js'

const CookMode: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentStep, setCurrentStep] = useState(0)
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set())
  const [showDrawer, setShowDrawer] = useState(false)
  const [wakeLockUnsupported, setWakeLockUnsupported] = useState(false)

  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  const acquireWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) {
      setWakeLockUnsupported(true)
      return
    }
    try {
      wakeLockRef.current = await (navigator as any).wakeLock.request('screen')
    } catch {
      // Silently fail — not granted (e.g. low battery)
    }
  }, [])

  useEffect(() => {
    const fetchRecipe = async () => {
      try {
        const recipeId = parseInt(id || '0')
        const data = await getRecipe(recipeId)
        setRecipe(data)
      } catch {
        navigate('/')
      } finally {
        setIsLoading(false)
      }
    }
    fetchRecipe()
    acquireWakeLock()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') acquireWakeLock()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      wakeLockRef.current?.release().catch(() => {})
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [id])

  // Touch/swipe to navigate steps (mobile only — desktop uses click)
  const touchStartX = useRef<number | null>(null)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || !recipe || showDrawer) return
    const delta = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(delta) < 50) return
    if (delta > 0 && currentStep < recipe.steps.length - 1) setCurrentStep((s) => s + 1)
    else if (delta < 0 && currentStep > 0) setCurrentStep((s) => s - 1)
    touchStartX.current = null
  }

  const toggleIngredient = (idx: number) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-espresso flex items-center justify-center">
        <div className="text-cream text-lg">Lade Rezept…</div>
      </div>
    )
  }

  if (!recipe) return null

  const totalSteps = recipe.steps.length
  const progress = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0
  const isFirst = currentStep === 0
  const isLast = currentStep === totalSteps - 1
  const checkedCount = checkedIngredients.size
  const totalIngredients = recipe.ingredients.length

  // Reusable ingredients list (used in both sidebar and drawer)
  const IngredientList = () => (
    <ul className="space-y-1">
      {recipe.ingredients.map((ing, idx) => (
        <li
          key={idx}
          onClick={() => toggleIngredient(idx)}
          className="flex items-start space-x-3 py-2.5 px-2 rounded-xl cursor-pointer hover:bg-white/5 active:bg-white/10 transition-colors"
        >
          {checkedIngredients.has(idx) ? (
            <CheckSquare size={18} className="text-saffron flex-shrink-0 mt-0.5" />
          ) : (
            <Square size={18} className="text-cream/35 flex-shrink-0 mt-0.5" />
          )}
          <span className={`text-sm leading-snug ${checkedIngredients.has(idx) ? 'line-through text-cream/35' : 'text-cream'}`}>
            {scaleIngredient(ing, 1)}
          </span>
        </li>
      ))}
    </ul>
  )

  return (
    <div
      className="fixed inset-0 bg-espresso text-cream flex flex-col select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 flex-shrink-0">
        <button
          onClick={() => navigate(`/recipe/${id}`)}
          className="p-2 rounded-xl hover:bg-white/10 transition-colors"
          aria-label="Zurück"
        >
          <X size={22} />
        </button>

        <div className="text-center">
          <div className="text-xs text-cream/50 font-medium tracking-wide uppercase mb-0.5">
            Schritt {currentStep + 1} von {totalSteps}
          </div>
          <div className="text-base font-display font-semibold truncate max-w-[200px]">
            {recipe.emoji} {recipe.name}
          </div>
        </div>

        {/* Placeholder to balance flex layout — ingredients shown inline on desktop */}
        <div className="w-10" />
      </div>

      {/* ── Progress bar ────────────────────────────────────────── */}
      <div className="h-1 bg-white/10 mx-4 rounded-full overflow-hidden flex-shrink-0">
        <div
          className="h-full bg-saffron rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Wake lock warning */}
      {wakeLockUnsupported && (
        <div className="mx-4 mt-3 flex items-center space-x-2 bg-amber-500/20 text-amber-300 text-xs px-3 py-2 rounded-lg flex-shrink-0">
          <AlertCircle size={14} className="flex-shrink-0" />
          <span>Bildschirm bleibt ohne HTTPS möglicherweise nicht an.</span>
        </div>
      )}

      {/* ── Main content: two-column on md+, single column on mobile ── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* ── LEFT: Ingredients sidebar (tablet/desktop only) ─── */}
        <aside className="hidden md:flex flex-col w-72 lg:w-80 xl:w-88 border-r border-white/10 flex-shrink-0">
          <div className="px-5 pt-5 pb-3 border-b border-white/10">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-base">Zutaten</h2>
              {checkedCount > 0 && (
                <span className="text-xs text-saffron font-medium">
                  {checkedCount}/{totalIngredients} abgehakt
                </span>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <IngredientList />
          </div>
        </aside>

        {/* ── RIGHT: Step content ──────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 flex items-center justify-center px-6 md:px-10 py-8 overflow-hidden">
            <div className="max-w-2xl w-full">
              <p className="text-2xl sm:text-3xl md:text-2xl lg:text-3xl leading-relaxed font-medium text-center md:text-left">
                {recipe.steps[currentStep]}
              </p>
            </div>
          </div>

          {/* ── Navigation buttons ──────────────────────────────── */}
          <div className="px-4 md:px-6 pb-6 flex-shrink-0 space-y-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
                disabled={isFirst}
                className="flex items-center space-x-2 px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium"
              >
                <ChevronLeft size={20} />
                <span className="hidden sm:inline">Zurück</span>
              </button>

              {isLast ? (
                <button
                  onClick={() => navigate(`/recipe/${id}`)}
                  className="flex-1 py-3 rounded-2xl bg-saffron text-espresso font-bold hover:bg-yellow-400 transition-colors text-center"
                >
                  Fertig 🎉
                </button>
              ) : (
                <button
                  onClick={() => setCurrentStep((s) => Math.min(totalSteps - 1, s + 1))}
                  className="flex-1 flex items-center justify-center space-x-2 py-3 rounded-2xl bg-saffron text-espresso hover:bg-yellow-400 transition-colors font-semibold"
                >
                  <span>Weiter</span>
                  <ChevronRight size={20} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile: Zutaten trigger bar (below content, above safe area) ── */}
      <button
        onClick={() => setShowDrawer(true)}
        className="md:hidden mx-4 mb-4 flex-shrink-0 flex items-center justify-between px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/15 active:bg-white/20 transition-colors border border-white/10"
      >
        <div className="flex items-center space-x-3">
          <ListChecks size={20} className="text-saffron" />
          <span className="font-medium text-sm">Zutaten</span>
        </div>
        <div className="flex items-center space-x-2">
          {checkedCount > 0 && (
            <span className="text-xs font-medium bg-saffron text-espresso px-2 py-0.5 rounded-full">
              {checkedCount}/{totalIngredients}
            </span>
          )}
          {checkedCount === 0 && (
            <span className="text-xs text-cream/40">{totalIngredients} Zutaten</span>
          )}
          <ChevronUp size={16} className="text-cream/50" />
        </div>
      </button>

      {/* ── Mobile: Ingredients drawer ───────────────────────────── */}
      {showDrawer && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-20 flex items-end"
          onClick={() => setShowDrawer(false)}
        >
          <div
            className="w-full bg-[#1e1e1e] rounded-t-3xl max-h-[75vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-white/10 flex-shrink-0">
              <div>
                <h2 className="font-display font-bold text-base text-cream">Zutaten</h2>
                {checkedCount > 0 && (
                  <p className="text-xs text-saffron mt-0.5">{checkedCount} von {totalIngredients} abgehakt</p>
                )}
              </div>
              <button
                onClick={() => setShowDrawer(false)}
                className="p-2 rounded-xl hover:bg-white/10 transition-colors text-cream"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable list */}
            <div className="overflow-y-auto px-3 py-3 pb-8">
              <IngredientList />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CookMode
