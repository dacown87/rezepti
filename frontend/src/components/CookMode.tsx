import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, X, CheckSquare, Square, AlertCircle } from 'lucide-react'
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
  const [showIngredients, setShowIngredients] = useState(false)
  const [wakeLockUnsupported, setWakeLockUnsupported] = useState(false)

  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  // Acquire wake lock to keep screen on
  const acquireWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) {
      setWakeLockUnsupported(true)
      return
    }
    try {
      wakeLockRef.current = await (navigator as any).wakeLock.request('screen')
    } catch {
      // Silently fail — wakeLock not granted (e.g. low battery)
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

    // Re-acquire wake lock when page becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        acquireWakeLock()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      wakeLockRef.current?.release().catch(() => {})
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [id])

  // Touch/swipe handling
  const touchStartX = useRef<number | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || !recipe) return
    const delta = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(delta) < 50) return
    if (delta > 0 && currentStep < recipe.steps.length - 1) {
      setCurrentStep((s) => s + 1)
    } else if (delta < 0 && currentStep > 0) {
      setCurrentStep((s) => s - 1)
    }
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

  return (
    <div
      className="fixed inset-0 bg-espresso text-cream flex flex-col select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-safe pt-4 pb-3">
        <button
          onClick={() => navigate(`/recipe/${id}`)}
          className="p-2 rounded-xl hover:bg-white/10 transition-colors"
          aria-label="Zurück"
        >
          <X size={22} />
        </button>

        <div className="text-center">
          <div className="text-sm text-cream/60 font-medium">
            Schritt {currentStep + 1} von {totalSteps}
          </div>
          <div className="text-base font-display font-semibold truncate max-w-[180px]">
            {recipe.emoji} {recipe.name}
          </div>
        </div>

        <button
          onClick={() => setShowIngredients(true)}
          className="p-2 rounded-xl hover:bg-white/10 transition-colors"
          aria-label="Zutaten anzeigen"
        >
          <CheckSquare size={22} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/10 mx-4 rounded-full overflow-hidden">
        <div
          className="h-full bg-saffron rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Wake lock warning */}
      {wakeLockUnsupported && (
        <div className="mx-4 mt-3 flex items-center space-x-2 bg-amber-500/20 text-amber-300 text-xs px-3 py-2 rounded-lg">
          <AlertCircle size={14} className="flex-shrink-0" />
          <span>Bildschirm bleibt ohne HTTPS möglicherweise nicht an.</span>
        </div>
      )}

      {/* Step content */}
      <div className="flex-1 flex items-center justify-center px-6 py-8 overflow-hidden">
        <div className="max-w-xl w-full">
          <p className="text-2xl sm:text-3xl leading-relaxed font-medium text-center">
            {recipe.steps[currentStep]}
          </p>
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between px-4 pb-safe pb-6 gap-4">
        <button
          onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
          disabled={isFirst}
          className="flex items-center space-x-2 px-6 py-3 rounded-2xl bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium"
        >
          <ChevronLeft size={20} />
          <span>Zurück</span>
        </button>

        {isLast ? (
          <button
            onClick={() => navigate(`/recipe/${id}`)}
            className="flex-1 py-3 rounded-2xl bg-saffron text-espresso font-bold hover:bg-saffron-light transition-colors text-center"
          >
            Fertig 🎉
          </button>
        ) : (
          <button
            onClick={() => setCurrentStep((s) => Math.min(totalSteps - 1, s + 1))}
            className="flex items-center space-x-2 px-6 py-3 rounded-2xl bg-saffron text-espresso hover:bg-saffron-light transition-colors font-medium"
          >
            <span>Weiter</span>
            <ChevronRight size={20} />
          </button>
        )}
      </div>

      {/* Ingredients drawer */}
      {showIngredients && (
        <div
          className="fixed inset-0 bg-black/60 z-10 flex items-end"
          onClick={() => setShowIngredients(false)}
        >
          <div
            className="w-full bg-[#2a2a2a] rounded-t-3xl px-5 pt-5 pb-safe pb-8 max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-display font-bold text-cream">Zutaten</h2>
              <button
                onClick={() => setShowIngredients(false)}
                className="p-2 rounded-xl hover:bg-white/10 transition-colors text-cream"
              >
                <X size={20} />
              </button>
            </div>
            <ul className="space-y-2">
              {recipe.ingredients.map((ing, idx) => (
                <li
                  key={idx}
                  onClick={() => toggleIngredient(idx)}
                  className="flex items-center space-x-3 py-2 cursor-pointer"
                >
                  {checkedIngredients.has(idx) ? (
                    <CheckSquare size={20} className="text-saffron flex-shrink-0" />
                  ) : (
                    <Square size={20} className="text-cream/40 flex-shrink-0" />
                  )}
                  <span className={`text-sm ${checkedIngredients.has(idx) ? 'line-through text-cream/40' : 'text-cream'}`}>
                    {scaleIngredient(ing, 1)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

export default CookMode
