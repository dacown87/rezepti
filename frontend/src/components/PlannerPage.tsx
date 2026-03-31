import React, { useState, useEffect, useRef } from 'react'
import { Calendar, ChevronLeft, ChevronRight, Plus, Trash2, ShoppingCart, ChefHat, GripVertical, Camera, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { DndContext, DragEndEvent, DragOverlay, useDraggable, useDroppable, DragStartEvent } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { isRecipeJSONQR, decodeRecipeFromCompactJSON, parseCompactRecipeToFull } from '../utils/recipe-qr.js'
import { getMealPlan, addToMealPlan, removeFromMealPlan, clearMealPlan, getRecipes, addShoppingItem, saveRecipe } from '../api/services.js'
import type { MealPlanEntry, Recipe } from '../api/types.js'
import { useToast } from './ToastManager'

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats: string[] }) => {
      detect: (image: ImageBitmapSource) => Promise<{ rawValue: string }[]>
    }
  }
}

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const DAY_NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']

interface DraggableRecipeProps {
  entry: MealPlanEntry
  recipe?: Recipe
  onRemove: (id: number) => void
}

const DraggableRecipe: React.FC<DraggableRecipeProps> = ({ entry, recipe, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: entry.id,
    data: { entry }
  })

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab'
  } : { cursor: 'grab' }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group bg-warmgray/5 rounded-lg p-2 text-sm flex items-center justify-between ${isDragging ? 'z-50' : ''}`}
      {...listeners}
      {...attributes}
    >
      <span className="truncate flex-1">
        {recipe ? `${recipe.emoji} ${recipe.name}` : `Rezept #${entry.recipe_id}`}
      </span>
      <div className="flex items-center gap-1">
        <GripVertical size={14} className="text-warmgray/50 opacity-0 group-hover:opacity-100 transition-opacity" />
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove(entry.id)
          }}
          className="opacity-0 group-hover:opacity-100 text-warmgray hover:text-red-500 transition-all"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

interface DayColumnProps {
  dayIndex: number
  day: string
  dayName: string
  dayRecipes: MealPlanEntry[]
  recipes: Recipe[]
  onRemoveRecipe: (id: number) => void
  onAddRecipe: () => void
  isWeekend: boolean
}

const DayColumn: React.FC<DayColumnProps> = ({
  dayIndex, day, dayName, dayRecipes, recipes, onRemoveRecipe, onAddRecipe, isWeekend
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${dayIndex}`
  })

  return (
    <div
      ref={setNodeRef}
      className={`bg-white rounded-xl border min-h-[180px] flex flex-col transition-colors ${
        isWeekend ? 'md:border-saffron/30 md:bg-saffron/5' : 'border-warmgray/10'
      } ${isOver ? 'ring-2 ring-paprika ring-offset-2 bg-paprika/5' : ''}`}
    >
      <div className={`p-3 text-center border-b ${isWeekend ? 'bg-saffron/10' : ''}`}>
        <div className="font-medium">{day}</div>
        <div className="text-xs text-warmgray">{dayName}</div>
      </div>
      
      <div className="flex-1 p-2 space-y-2">
        {dayRecipes.map(entry => {
          const recipe = recipes.find(r => r.id === entry.recipe_id)
          return (
            <DraggableRecipe
              key={entry.id}
              entry={entry}
              recipe={recipe}
              onRemove={onRemoveRecipe}
            />
          )
        })}
      </div>

      <button
        onClick={onAddRecipe}
        className="m-2 p-2 text-warmgray/50 hover:text-paprika hover:bg-paprika/5 rounded-lg transition-colors text-xs flex items-center justify-center gap-1"
      >
        <Plus size={14} />
        <span className="hidden sm:inline">Rezept</span>
      </button>
    </div>
  )
}

function getWeekStart(date: Date): number {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  d.setHours(0, 0, 0, 0)
  return Math.floor(d.getTime() / 1000)
}

function formatWeekRange(weekStart: number): string {
  const start = new Date(weekStart * 1000)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  return `${start.toLocaleDateString('de-DE', options)} – ${end.toLocaleDateString('de-DE', options)}`
}

const PlannerPage: React.FC = () => {
  const [entries, setEntries] = useState<MealPlanEntry[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()))
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState<number | null>(null)
  const [modalTab, setModalTab] = useState<'recipe' | 'camera'>('recipe')
  const [isGeneratingShopping, setIsGeneratingShopping] = useState(false)
  const [activeRecipe, setActiveRecipe] = useState<MealPlanEntry | null>(null)
  const [qrError, setQrError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanningRef = useRef(false)
  const { addToast } = useToast()

  useEffect(() => {
    loadData()
  }, [weekStart])

  useEffect(() => {
    if (showAddModal === null || modalTab !== 'camera') {
      stopQRScanning()
    }
    return () => stopQRScanning()
  }, [showAddModal, modalTab])

  const loadData = async () => {
    try {
      const [planData, recipesData] = await Promise.all([
        getMealPlan(weekStart),
        getRecipes()
      ])
      setEntries(planData.entries)
      setRecipes(recipesData)
    } catch (error) {
      console.error('Failed to load data:', error)
      addToast('Fehler beim Laden', 'error')
    } finally {
      setLoading(false)
    }
  }

  const prevWeek = () => setWeekStart(w => w - 7 * 24 * 60 * 60)
  const nextWeek = () => setWeekStart(w => w + 7 * 24 * 60 * 60)

  const handleAddRecipe = async (recipeId: number) => {
    if (showAddModal === null) return
    try {
      const result = await addToMealPlan(recipeId, showAddModal, weekStart)
      setEntries([...entries, {
        id: result.id,
        recipe_id: recipeId,
        day_of_week: showAddModal,
        week_start: weekStart,
        created_at: new Date().toISOString()
      }])
      setShowAddModal(null)
      setModalTab('recipe')
      addToast('Rezept zum Plan hinzugefügt', 'success')
    } catch (error) {
      console.error('Failed to add recipe:', error)
      addToast('Fehler beim Hinzufügen', 'error')
    }
  }

  const handleRemoveRecipe = async (entryId: number) => {
    try {
      await removeFromMealPlan(entryId)
      setEntries(entries.filter(e => e.id !== entryId))
      addToast('Rezept entfernt', 'success')
    } catch (error) {
      console.error('Failed to remove recipe:', error)
      addToast('Fehler beim Entfernen', 'error')
    }
  }

  const handleGenerateShoppingList = async () => {
    setIsGeneratingShopping(true)
    try {
      const recipeIds = [...new Set(entries.map(e => e.recipe_id))]
      let addedCount = 0
      
      for (const recipeId of recipeIds) {
        const recipe = recipes.find(r => r.id === recipeId)
        if (recipe) {
          for (const ingredient of recipe.ingredients) {
            await addShoppingItem(recipeId, ingredient)
            addedCount++
          }
        }
      }
      
      addToast(`${addedCount} Zutaten zur Einkaufsliste hinzugefügt`, 'success')
    } catch (error) {
      console.error('Failed to generate shopping list:', error)
      addToast('Fehler beim Erstellen der Einkaufsliste', 'error')
    } finally {
      setIsGeneratingShopping(false)
    }
  }

  const handleClearWeek = async () => {
    if (!confirm('Den Wochenplan löschen?')) return
    try {
      await clearMealPlan(weekStart)
      setEntries([])
      addToast('Wochenplan geleert', 'success')
    } catch (error) {
      console.error('Failed to clear week:', error)
      addToast('Fehler beim Löschen', 'error')
    }
  }

  const getRecipesForDay = (dayIndex: number) => {
    return entries.filter(e => e.day_of_week === dayIndex)
  }

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as number
    const entry = entries.find(e => e.id === id)
    setActiveRecipe(entry || null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveRecipe(null)

    if (!over) return

    const entryId = active.id as number
    const overId = over.id as string
    const targetDay = parseInt(overId.replace('day-', ''))

    if (isNaN(targetDay)) return

    const entry = entries.find(e => e.id === entryId)
    if (!entry) return

    if (entry.day_of_week === targetDay) return

    try {
      await removeFromMealPlan(entryId)
      const result = await addToMealPlan(entry.recipe_id, targetDay, weekStart)
      setEntries([
        ...entries.filter(e => e.id !== entryId),
        {
          id: result.id,
          recipe_id: entry.recipe_id,
          day_of_week: targetDay,
          week_start: weekStart,
          created_at: new Date().toISOString()
        }
      ])
      addToast('Rezept verschoben', 'success')
    } catch (error) {
      console.error('Failed to move recipe:', error)
      addToast('Fehler beim Verschieben', 'error')
      loadData()
    }
  }

  const startQRScanning = async () => {
    setQrError(null)

    if (!window.BarcodeDetector) {
      setQrError('QR-Scanner nicht verfügbar. Bitte nutze einen Chromium-Browser (Chrome, Edge).')
      return
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setQrError('Kamera wird in diesem Browser nicht unterstützt.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        scanningRef.current = true
        requestAnimationFrame(scanQRFrame)
      } else {
        stream.getTracks().forEach(track => track.stop())
        streamRef.current = null
        setQrError('Video-Element nicht gefunden. Bitte Seite neu laden.')
      }
    } catch (err: any) {
      console.error('Camera error:', err)
      if (err.name === 'NotAllowedError') {
        setQrError('Kamera-Zugriff verweigert. Tippe auf das Schloss-Symbol in der Adressleiste → Kamera → Erlauben, dann Seite neu laden.')
      } else if (err.name === 'NotFoundError') {
        setQrError('Keine Kamera gefunden.')
      } else if (err.name === 'NotReadableError') {
        setQrError('Kamera wird bereits von einer anderen App verwendet.')
      } else {
        setQrError('Kamera konnte nicht geöffnet werden.')
      }
    }
  }

  const scanQRFrame = async () => {
    if (!videoRef.current || !scanningRef.current) return
    try {
      const detector = new window.BarcodeDetector!({ formats: ['qr_code'] })
      const barcodes = await detector.detect(videoRef.current)
      if (barcodes.length > 0) {
        const value = barcodes[0].rawValue
        if (isRecipeJSONQR(value)) {
          const decoded = decodeRecipeFromCompactJSON(value)
          if (decoded) {
            stopQRScanning()
            handleAddRecipeFromQR(parseCompactRecipeToFull(decoded))
            return
          }
        }
      }
    } catch { /* ignore */ }
    if (scanningRef.current) requestAnimationFrame(scanQRFrame)
  }

  const stopQRScanning = () => {
    scanningRef.current = false
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }

  const handleAddRecipeFromQR = async (partial: Partial<Recipe>) => {
    if (!partial.name || !partial.ingredients || !partial.steps) {
      addToast('Ungültige Rezeptdaten', 'error')
      return
    }
    try {
      const existing = recipes.find(r => r.name === partial.name)
      if (existing) {
        await handleAddRecipe(existing.id)
        return
      }
      const saved = await saveRecipe({
        name: partial.name,
        emoji: partial.emoji || '🍽️',
        ingredients: partial.ingredients,
        steps: partial.steps,
        servings: partial.servings || '',
        duration: partial.duration || '',
        tags: partial.tags || [],
        imageUrl: partial.imageUrl,
      }, 'qr://planner')
      await handleAddRecipe(saved.id)
    } catch (err) {
      console.error('QR add failed:', err)
      addToast('Fehler beim Hinzufügen', 'error')
    }
  }

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-paprika"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-3">
            <Calendar className="h-8 w-8 text-paprika" />
            Wochenplan
          </h1>
          <p className="text-warmgray mt-1">Plane deine Mahlzeiten für die Woche</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleGenerateShoppingList}
            disabled={entries.length === 0 || isGeneratingShopping}
            className="flex items-center gap-2 bg-saffron text-espresso px-4 py-2 rounded-lg hover:bg-saffron-light transition-colors disabled:opacity-50"
          >
            <ShoppingCart size={18} />
            <span className="hidden sm:inline">Einkaufsliste</span>
          </button>
        </div>
      </div>

      <>
        {/* Week navigation */}
        <div className="flex items-center justify-between mb-6 bg-white rounded-xl p-4 border border-warmgray/10">
        <button
          onClick={prevWeek}
          className="p-2 hover:bg-warmgray/10 rounded-lg transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="text-lg font-medium">{formatWeekRange(weekStart)}</div>
        <button
          onClick={nextWeek}
          className="p-2 hover:bg-warmgray/10 rounded-lg transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* 7-day grid */}
      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {DAYS.map((day, index) => {
            const dayRecipes = getRecipesForDay(index)
            return (
              <DayColumn
                key={index}
                dayIndex={index}
                day={day}
                dayName={DAY_NAMES[index]}
                dayRecipes={dayRecipes}
                recipes={recipes}
                onRemoveRecipe={handleRemoveRecipe}
                onAddRecipe={() => setShowAddModal(index)}
                isWeekend={index === 5 || index === 6}
              />
            )
          })}
        </div>
        <DragOverlay>
          {activeRecipe && (
            <div className="bg-white rounded-lg p-2 text-sm flex items-center gap-2 shadow-xl border border-paprika/30 opacity-90">
              <GripVertical size={14} className="text-paprika" />
              <span className="truncate">
                {activeRecipe && (() => {
                  const r = recipes.find(rec => rec.id === activeRecipe.recipe_id)
                  return r ? `${r.emoji} ${r.name}` : `Rezept #${activeRecipe.recipe_id}`
                })()}
              </span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {entries.length > 0 && (
        <div className="mt-6 text-center">
          <button
            onClick={handleClearWeek}
            className="text-sm text-warmgray hover:text-red-600 transition-colors"
          >
            Woche leeren
          </button>
        </div>
      )}

      </>

      {/* Add Recipe Modal */}
      {showAddModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-display font-bold">Rezept hinzufügen</h2>
              <button
                onClick={() => { setShowAddModal(null); setModalTab('recipe') }}
                className="text-warmgray hover:text-gray-700"
              >
                <X size={22} />
              </button>
            </div>

            {/* Tab controller */}
            <div className="flex rounded-lg border border-warmgray/20 p-1 mb-4 bg-warmgray/5">
              <button
                onClick={() => setModalTab('recipe')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
                  modalTab === 'recipe'
                    ? 'bg-white shadow-sm text-espresso'
                    : 'text-warmgray hover:text-espresso'
                }`}
              >
                <ChefHat size={16} />
                Rezept
              </button>
              <button
                onClick={() => { setModalTab('camera'); startQRScanning() }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
                  modalTab === 'camera'
                    ? 'bg-white shadow-sm text-espresso'
                    : 'text-warmgray hover:text-espresso'
                }`}
              >
                <Camera size={16} />
                Kamera
              </button>
            </div>

            {/* Camera tab - video always in DOM to avoid race condition with getUserMedia */}
            <div className={`flex-1 flex flex-col ${modalTab === 'camera' ? '' : 'hidden'}`}>
              {qrError && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {qrError}
                </div>
              )}
              <div className="relative rounded-xl overflow-hidden bg-black aspect-square mb-3">
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              </div>
              <p className="text-sm text-warmgray text-center">QR-Code eines Rezepts in den Rahmen halten...</p>
            </div>
            {/* Recipe tab */}
            {modalTab !== 'camera' && (
              <>
                <p className="text-warmgray mb-4">Wähle ein Rezept für {DAY_NAMES[showAddModal]}:</p>
                <div className="overflow-y-auto flex-1 space-y-2">
                  {recipes.length === 0 ? (
                    <div className="text-center py-8 text-warmgray">
                      <ChefHat className="h-12 w-12 mx-auto mb-2 opacity-30" />
                      <p>Keine Rezepte vorhanden</p>
                      <Link to="/extract" className="text-paprika hover:text-paprika-dark text-sm">
                        Rezept extrahieren
                      </Link>
                    </div>
                  ) : (
                    recipes.map(recipe => (
                      <button
                        key={recipe.id}
                        onClick={() => handleAddRecipe(recipe.id)}
                        className="w-full text-left px-4 py-3 rounded-lg border border-warmgray/20 hover:border-paprika hover:bg-paprika/5 transition-colors flex items-center gap-2"
                      >
                        <span className="text-xl">{recipe.emoji}</span>
                        <span className="truncate">{recipe.name}</span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default PlannerPage