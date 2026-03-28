import React, { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, Users, Flame, Edit, Trash2, ChefHat, Loader2, AlertCircle, ExternalLink, Save, X, Pencil, RotateCcw, UtensilsCrossed, Star, ShoppingCart, Download, Share2 } from 'lucide-react'
import { getRecipe, deleteRecipe, updateRecipe } from '../api/services.js'
import { parseServingsNumber, scaleIngredient, parseIngredientNumber, splitIngredient } from '../utils/scaling.js'
import { generateRecipePDF, downloadPDF } from '../utils/pdf-export.js'
import type { Recipe } from '../api/types.js'
import { useToast } from './ToastManager'
import { RecipeDetailSkeleton } from './SkeletonLoader'
import ShareModal from './ShareModal'

const RecipeDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editDraft, setEditDraft] = useState<{
    name: string; emoji: string; duration: string; servings: string
    calories: string; tags: string; ingredients: string[]; steps: string[]
  } | null>(null)
  const [servingMultiplier, setServingMultiplier] = useState(1)
  const [editingIngredientIndex, setEditingIngredientIndex] = useState<number | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [rating, setRating] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [hoverRating, setHoverRating] = useState<number | null>(null)
  const [isExportingPDF, setIsExportingPDF] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { addToast } = useToast()

  useEffect(() => {
    if (id) {
      fetchRecipe()
    }
  }, [id])

  const fetchRecipe = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const recipeId = parseInt(id || '0')
      if (isNaN(recipeId)) {
        throw new Error('Ungültige Rezept-ID')
      }

      const data = await getRecipe(recipeId)
      setRecipe(data)
      setRating(data.rating ?? null)
      setNotes(data.notes ?? '')
    } catch (err: any) {
      console.error('Failed to load recipe:', err)
      const errorMsg = err.message || 'Rezept konnte nicht geladen werden'
      setError(errorMsg)
      addToast(errorMsg, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!recipe) return
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!recipe) return
    
    setIsDeleting(true)
    setShowDeleteModal(false)
    
    try {
      await deleteRecipe(recipe.id)
      addToast('Rezept erfolgreich gelöscht', 'success')
      navigate('/')
    } catch (err: any) {
      console.error('Failed to delete recipe:', err)
      const errorMsg = 'Rezept konnte nicht gelöscht werden. Bitte versuche es erneut.'
      addToast(errorMsg, 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleEdit = () => {
    if (!recipe) return
    setEditDraft({
      name: recipe.name,
      emoji: recipe.emoji,
      duration: recipe.duration,
      servings: recipe.servings,
      calories: String(recipe.calories ?? ''),
      tags: recipe.tags.join(', '),
      ingredients: [...recipe.ingredients],
      steps: [...recipe.steps],
    })
    setIsEditing(true)
  }

  const handleExportPDF = async () => {
    if (!recipe) return
    setIsExportingPDF(true)
    try {
      const blob = await generateRecipePDF(recipe)
      const filename = `${recipe.name.replace(/[^a-z0-9]/gi, '_')}.pdf`
      downloadPDF(blob, filename)
      addToast('PDF heruntergeladen', 'success')
    } catch (error) {
      console.error('PDF export failed:', error)
      addToast('PDF konnte nicht erstellt werden', 'error')
    } finally {
      setIsExportingPDF(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditDraft(null)
  }

  const handleSave = async () => {
    if (!recipe || !editDraft) return
    setIsSaving(true)
    try {
      await updateRecipe(recipe.id, {
        name: editDraft.name.trim(),
        emoji: editDraft.emoji.trim(),
        duration: editDraft.duration.trim(),
        servings: editDraft.servings.trim(),
        calories: editDraft.calories ? parseInt(editDraft.calories) : undefined,
        tags: editDraft.tags.split(',').map(t => t.trim()).filter(Boolean),
        ingredients: editDraft.ingredients.map(l => l.trim()).filter(Boolean),
        steps: editDraft.steps.map(l => l.trim()).filter(Boolean),
      })
      const updated = await getRecipe(recipe.id)
      setRecipe(updated)
      setIsEditing(false)
      setEditDraft(null)
      addToast('Rezept gespeichert', 'success')
    } catch (err: any) {
      addToast('Speichern fehlgeschlagen. Bitte erneut versuchen.', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleRating = async (stars: number) => {
    const newRating = rating === stars ? null : stars
    setRating(newRating)
    try {
      await updateRecipe(parseInt(id || '0'), { rating: newRating } as any)
    } catch {
      addToast('Bewertung konnte nicht gespeichert werden.', 'error')
    }
  }

  const handleNotesChange = (value: string) => {
    setNotes(value)
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current)
    notesTimerRef.current = setTimeout(async () => {
      try {
        await updateRecipe(parseInt(id || '0'), { notes: value } as any)
      } catch {
        addToast('Notiz konnte nicht gespeichert werden.', 'error')
      }
    }, 800)
  }

  const handleIngredientConfirm = (index: number) => {
    const enteredValue = parseFloat(editingValue)
    if (!isNaN(enteredValue) && enteredValue > 0 && recipe) {
      const originalNum = parseIngredientNumber(recipe.ingredients[index])
      if (originalNum && originalNum > 0) {
        setServingMultiplier(Math.max(0.01, enteredValue / originalNum))
      }
    }
    setEditingIngredientIndex(null)
    setEditingValue('')
  }

  if (isLoading) {
    return <RecipeDetailSkeleton />
  }

  if (error || !recipe) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            to="/"
            className="inline-flex items-center space-x-2 text-warmgray hover:text-espresso transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Zurück zu Rezepten</span>
          </Link>
        </div>
        
        <div className="bg-white rounded-2xl shadow-lg border border-warmgray/10 p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-display font-bold mb-2">Rezept nicht gefunden</h2>
          <p className="text-warmgray mb-6">{error || 'Das Rezept existiert nicht oder konnte nicht geladen werden.'}</p>
          <Link
            to="/"
            className="bg-paprika text-white px-6 py-3 rounded-lg font-medium hover:bg-paprika-dark transition-colors"
          >
            Zurück zur Übersicht
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back button */}
      <div className="mb-6">
        <Link
          to="/"
          className="inline-flex items-center space-x-2 text-warmgray hover:text-espresso transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Zurück zu Rezepten</span>
        </Link>
      </div>

      {/* Recipe header */}
      <div className="bg-white rounded-2xl shadow-lg border border-warmgray/10 overflow-hidden mb-8">
        <div className="relative h-64 md:h-80 bg-warmgray/10">
          {recipe.imageUrl ? (
            <img
              src={recipe.imageUrl}
              alt={recipe.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ChefHat className="h-24 w-24 text-warmgray/40" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6 text-white">
            {isEditing && editDraft ? (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    value={editDraft.emoji}
                    onChange={e => setEditDraft(d => d && ({ ...d, emoji: e.target.value }))}
                    className="w-14 text-2xl text-center bg-white/20 border border-white/30 rounded-lg px-1 py-1 text-white placeholder-white/60 focus:outline-none focus:border-white"
                    maxLength={2}
                  />
                  <input
                    value={editDraft.name}
                    onChange={e => setEditDraft(d => d && ({ ...d, name: e.target.value }))}
                    className="flex-1 text-2xl font-display font-bold bg-white/20 border border-white/30 rounded-lg px-3 py-1 text-white placeholder-white/60 focus:outline-none focus:border-white"
                    placeholder="Rezeptname"
                  />
                </div>
                <input
                  value={editDraft.tags}
                  onChange={e => setEditDraft(d => d && ({ ...d, tags: e.target.value }))}
                  className="w-full text-sm bg-white/20 border border-white/30 rounded-lg px-3 py-1 text-white placeholder-white/60 focus:outline-none focus:border-white"
                  placeholder="Tags, kommagetrennt"
                />
              </div>
            ) : (
              <>
                <div className="flex items-center space-x-3 mb-2">
                  <span className="text-4xl">{recipe.emoji}</span>
                  <h1 className="text-3xl md:text-4xl font-display font-bold">{recipe.name}</h1>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {recipe.tags.map((tag) => (
                    <span key={tag} className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-sm">
                      {tag}
                    </span>
                  ))}
                  {rating && (
                    <div className="flex items-center space-x-0.5 ml-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={14}
                          className={s <= rating ? 'text-saffron' : 'text-white/20'}
                          fill={s <= rating ? 'currentColor' : 'none'}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="p-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-8">
            {/* Dauer */}
            <div className="text-center p-3 sm:p-4 bg-cream rounded-xl">
              <div className="flex items-center justify-center space-x-1 text-warmgray mb-1">
                <Clock size={16} />
                <span className="text-xs sm:text-sm">Dauer</span>
              </div>
              {isEditing && editDraft ? (
                <input
                  value={editDraft.duration}
                  onChange={e => setEditDraft(d => d && ({ ...d, duration: e.target.value }))}
                  className="w-full text-center font-bold text-espresso bg-white border border-warmgray/30 rounded px-1 py-0.5 text-sm focus:outline-none focus:border-paprika"
                  placeholder="30 min"
                />
              ) : (
                <div className="font-bold text-espresso text-sm sm:text-base">{recipe.duration}</div>
              )}
            </div>

            {/* Portionen */}
            <div className="text-center p-3 sm:p-4 bg-cream rounded-xl">
              <div className="flex items-center justify-center space-x-1 text-warmgray mb-1">
                <Users size={16} />
                <span className="text-xs sm:text-sm">Portionen</span>
              </div>
              <div className="font-bold text-espresso text-sm sm:text-base mb-3">
                {Math.round(parseServingsNumber(recipe.servings) * servingMultiplier)}
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setServingMultiplier(m => Math.max(0.5, m - 0.5))}
                    disabled={servingMultiplier <= 0.5}
                    className="w-8 h-8 bg-paprika text-white rounded-full flex items-center justify-center text-base font-bold hover:bg-paprika-dark disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                  >
                    −
                  </button>
                  <button
                    onClick={() => setServingMultiplier(m => Math.min(4, m + 0.5))}
                    disabled={servingMultiplier >= 4}
                    className="w-8 h-8 bg-paprika text-white rounded-full flex items-center justify-center text-base font-bold hover:bg-paprika-dark disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                  >
                    +
                  </button>
                </div>
                {servingMultiplier !== 1 && (
                  <span className="text-xs text-paprika font-medium">×{servingMultiplier}</span>
                )}
              </div>
            </div>

            {/* Pro Portion */}
            <div className="text-center p-3 sm:p-4 bg-cream rounded-xl">
              <div className="flex items-center justify-center space-x-1 text-warmgray mb-1">
                <Flame size={16} />
                <span className="text-xs sm:text-sm whitespace-nowrap">Pro Portion</span>
              </div>
              {isEditing && editDraft ? (
                <input
                  type="number"
                  value={editDraft.calories}
                  onChange={e => setEditDraft(d => d && ({ ...d, calories: e.target.value }))}
                  className="w-full text-center font-bold text-espresso bg-white border border-warmgray/30 rounded px-1 py-0.5 text-sm focus:outline-none focus:border-paprika"
                  placeholder="kcal"
                />
              ) : (
                <div className="font-bold text-espresso text-sm sm:text-base">{recipe.calories} kcal</div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex space-x-3 mb-8">
            {isEditing ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 bg-paprika text-white py-3 px-6 rounded-lg font-medium hover:bg-paprika-dark transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                  {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                  <span>{isSaving ? 'Speichern...' : 'Speichern'}</span>
                </button>
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="px-6 py-3 border border-warmgray/30 text-warmgray rounded-lg font-medium hover:bg-warmgray/5 transition-colors flex items-center space-x-2 disabled:opacity-50"
                >
                  <X size={20} />
                  <span>Abbrechen</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  to={`/recipe/${id}/cook`}
                  className="flex-1 bg-espresso text-cream py-3 px-6 rounded-lg font-medium hover:bg-espresso/80 transition-colors flex items-center justify-center space-x-2 transform hover:scale-[1.02] active:scale-[0.98] transition-transform duration-200 shadow-md hover:shadow-lg"
                >
                  <UtensilsCrossed size={20} />
                  <span>Kochen</span>
                </Link>
                <Link
                  to="/shopping"
                  onClick={() => {
                    const canonicalNames = recipe?.ingredients.map(i => {
                      const match = i.match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)?\s+(.*)/)
                      return match ? match[3] || i : i
                    }) || []
                    localStorage.setItem('pendingShoppingItems', JSON.stringify({
                      recipeId: recipe?.id,
                      ingredients: canonicalNames
                    }))
                  }}
                  className="flex-1 bg-saffron/20 text-saffron-dark py-3 px-6 rounded-lg font-medium hover:bg-saffron/30 transition-colors flex items-center justify-center space-x-2"
                >
                  <ShoppingCart size={20} />
                  <span>Einkauf</span>
                </Link>
                <button
                  onClick={handleEdit}
                  className="flex-1 bg-paprika text-white py-3 px-6 rounded-lg font-medium hover:bg-paprika-dark transition-colors flex items-center justify-center space-x-2 transform hover:scale-[1.02] active:scale-[0.98] transition-transform duration-200 shadow-md hover:shadow-lg"
                >
                  <Edit size={20} />
                  <span>Bearbeiten</span>
                </button>
                <button
                  onClick={handleExportPDF}
                  disabled={isExportingPDF}
                  className="flex-1 bg-warmgray/10 text-warmgray py-3 px-6 rounded-lg font-medium hover:bg-warmgray/20 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {isExportingPDF ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
                  <span>PDF</span>
                </button>
                <button
                  onClick={() => setShowShareModal(true)}
                  className="flex-1 bg-warmgray/10 text-warmgray py-3 px-6 rounded-lg font-medium hover:bg-warmgray/20 transition-colors flex items-center justify-center space-x-2"
                >
                  <Share2 size={20} />
                  <span>Teilen</span>
                </button>
              </>
            )}
          </div>

          {/* Ingredients + Steps: 2-column on desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Ingredients */}
            <div>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-warmgray/10">
                <h2 className="text-xl font-display font-bold">Zutaten</h2>
                {!isEditing && servingMultiplier !== 1 && (
                  <button
                    onClick={() => { setServingMultiplier(1); setEditingIngredientIndex(null) }}
                    className="flex items-center gap-1 text-xs text-paprika/70 hover:text-paprika transition-colors"
                  >
                    <RotateCcw size={12} />
                    Zurücksetzen
                  </button>
                )}
              </div>
              {isEditing && editDraft ? (
                <>
                  <ul className="space-y-2">
                    {editDraft.ingredients.map((ing, i) => (
                      <li key={i} className="flex items-baseline gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-paprika/40 flex-shrink-0 mt-2"></span>
                        <input
                          value={ing}
                          onChange={e => setEditDraft(d => {
                            if (!d) return d
                            const ingredients = [...d.ingredients]
                            ingredients[i] = e.target.value
                            return { ...d, ingredients }
                          })}
                          className="flex-1 text-sm text-warmgray bg-transparent border-b border-dashed border-warmgray/30 py-0.5 focus:outline-none focus:border-paprika"
                        />
                        <button
                          onClick={() => setEditDraft(d => {
                            if (!d) return d
                            return { ...d, ingredients: d.ingredients.filter((_, j) => j !== i) }
                          })}
                          className="ml-1 text-red-300 hover:text-red-500 text-lg leading-none flex-shrink-0"
                        >×</button>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => setEditDraft(d => d && { ...d, ingredients: [...d.ingredients, ''] })}
                    className="mt-2 text-sm text-paprika/60 hover:text-paprika flex items-center gap-1 transition-colors"
                  >
                    <span className="text-base leading-none">+</span> Zutat hinzufügen
                  </button>
                </>
              ) : (
                <ul className="space-y-2">
                  {recipe.ingredients.map((ingredient, index) => {
                    const parsedNumber = parseIngredientNumber(ingredient)
                    const canEdit = parsedNumber !== null
                    const isEditingThis = editingIngredientIndex === index

                    const scaledValue = parsedNumber !== null
                      ? Math.round(parsedNumber * servingMultiplier * 10) / 10
                      : null

                    return (
                      <li key={index} className="group flex items-start space-x-3">
                        <div className="w-2 h-2 bg-paprika rounded-full mt-2.5 flex-shrink-0"></div>
                        {isEditingThis ? (
                          <div className="flex items-center gap-1 flex-1">
                            <input
                              type="number"
                              value={editingValue}
                              onChange={e => setEditingValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleIngredientConfirm(index)
                                if (e.key === 'Escape') { setEditingIngredientIndex(null); setEditingValue('') }
                              }}
                              onBlur={() => handleIngredientConfirm(index)}
                              className="w-20 text-sm text-warmgray bg-white border border-paprika rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-paprika"
                              autoFocus
                            />
                            <span className="text-warmgray text-sm">{splitIngredient(ingredient)?.rest}</span>
                            <button
                              onClick={() => { setEditingIngredientIndex(null); setEditingValue('') }}
                              className="ml-1 text-warmgray/40 hover:text-red-500 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="text-warmgray text-sm flex-1">
                              {servingMultiplier === 1 ? ingredient : scaleIngredient(ingredient, servingMultiplier)}
                            </span>
                            {!isEditing && canEdit && (
                              <button
                                onClick={() => {
                                  setEditingIngredientIndex(index)
                                  setEditingValue(String(scaledValue))
                                }}
                                className="opacity-0 group-hover:opacity-100 sm:opacity-100 text-warmgray/40 hover:text-paprika transition-opacity ml-auto"
                                title="Menge anpassen"
                              >
                                <Pencil size={14} />
                              </button>
                            )}
                          </>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {/* Steps */}
            <div>
              <h2 className="text-xl font-display font-bold mb-4 pb-2 border-b border-warmgray/10">
                Zubereitung
              </h2>
              {isEditing && editDraft ? (
                <>
                  <ol className="space-y-3">
                    {editDraft.steps.map((step, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="w-6 h-6 rounded-full bg-paprika/10 flex items-center justify-center flex-shrink-0 mt-0.5 text-paprika text-xs font-bold font-display">
                          {i + 1}
                        </span>
                        <input
                          value={step}
                          onChange={e => setEditDraft(d => {
                            if (!d) return d
                            const steps = [...d.steps]
                            steps[i] = e.target.value
                            return { ...d, steps }
                          })}
                          className="flex-1 text-sm text-warmgray bg-transparent border-b border-dashed border-warmgray/30 py-0.5 focus:outline-none focus:border-paprika"
                        />
                        <button
                          onClick={() => setEditDraft(d => {
                            if (!d) return d
                            return { ...d, steps: d.steps.filter((_, j) => j !== i) }
                          })}
                          className="ml-1 text-red-300 hover:text-red-500 text-lg leading-none flex-shrink-0 mt-0.5"
                        >×</button>
                      </li>
                    ))}
                  </ol>
                  <button
                    onClick={() => setEditDraft(d => d && { ...d, steps: [...d.steps, ''] })}
                    className="mt-2 text-sm text-paprika/60 hover:text-paprika flex items-center gap-1 transition-colors"
                  >
                    <span className="text-base leading-none">+</span> Schritt hinzufügen
                  </button>
                </>
              ) : (
                <ol className="space-y-4">
                  {recipe.steps.map((step, index) => (
                    <li key={index} className="flex space-x-3">
                      <div className="flex-shrink-0 w-6 h-6 bg-paprika text-white rounded-full flex items-center justify-center font-bold text-xs">
                        {index + 1}
                      </div>
                      <p className="text-warmgray text-sm pt-0.5">{step}</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Rating + Notes */}
      <div className="bg-white rounded-2xl shadow-lg border border-warmgray/10 p-6 mb-8">
        {/* Stars */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-bold text-lg">Meine Bewertung</h3>
          <div className="flex items-center space-x-1">
            {[1, 2, 3, 4, 5].map((star) => {
              const filled = (hoverRating ?? rating ?? 0) >= star
              return (
                <button
                  key={star}
                  onClick={() => handleRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(null)}
                  className="p-0.5 transition-transform hover:scale-110 active:scale-95"
                  aria-label={`${star} Stern${star > 1 ? 'e' : ''}`}
                >
                  <Star
                    size={28}
                    className={filled ? 'text-saffron' : 'text-warmgray/25'}
                    fill={filled ? 'currentColor' : 'none'}
                  />
                </button>
              )
            })}
            {rating && (
              <button
                onClick={() => handleRating(rating)}
                className="ml-2 text-xs text-warmgray/50 hover:text-warmgray transition-colors"
                title="Bewertung entfernen"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Notes textarea */}
        <div>
          <label className="block text-sm font-medium text-warmgray mb-2">Notizen</label>
          <textarea
            value={notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="Eigene Anmerkungen, Anpassungen, Tipps…"
            rows={3}
            className="w-full text-sm text-espresso bg-cream/60 border border-warmgray/20 rounded-xl px-4 py-3 resize-none focus:outline-none focus:border-paprika/40 focus:ring-1 focus:ring-paprika/20 placeholder-warmgray/40 transition-colors"
          />
        </div>
      </div>

      {/* Source info */}
      {recipe.source_url && (
        <div className="bg-white rounded-2xl shadow-lg border border-warmgray/10 p-6 mb-8">
          <h3 className="font-display font-bold text-lg mb-3">Quelle</h3>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-paprika truncate">{recipe.source_url}</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-warmgray">
                {recipe.created_at ? `Extrahiert am ${new Date(recipe.created_at).toLocaleDateString('de-DE')}` : ''}
              </span>
              <a
                href={recipe.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 px-4 py-2 border border-warmgray/20 text-warmgray rounded-lg font-medium hover:bg-warmgray/5 transition-colors"
              >
                <ExternalLink size={16} />
                <span>Zum Original</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="bg-saffron/10 border border-saffron/20 rounded-2xl p-6">
        <h3 className="font-display font-bold text-lg mb-3">Hinweise</h3>
        <ul className="space-y-2 text-sm text-warmgray">
          <li className="flex items-start space-x-2">
            <div className="w-2 h-2 bg-saffron rounded-full mt-1.5"></div>
            <span>Rezept wurde automatisch aus der Quelle extrahiert und ins Deutsche übersetzt</span>
          </li>
          <li className="flex items-start space-x-2">
            <div className="w-2 h-2 bg-saffron rounded-full mt-1.5"></div>
            <span>Einheiten wurden in das metrische System konvertiert</span>
          </li>
          <li className="flex items-start space-x-2">
            <div className="w-2 h-2 bg-saffron rounded-full mt-1.5"></div>
            <span>Kalorien sind geschätzt basierend auf den Zutaten</span>
          </li>
        </ul>
      </div>

      {/* Delete button */}
      <div className="mt-6 flex justify-center">
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="text-red-500 text-sm hover:text-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <Trash2 size={16} />
          <span>Rezept löschen</span>
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-display font-bold mb-4">Rezept löschen</h3>
            <p className="text-warmgray mb-6">Rezept wird dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2 border border-warmgray/30 text-warmgray rounded-lg font-medium hover:bg-warmgray/5 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : null}
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && recipe && (
        <ShareModal recipe={recipe} onClose={() => setShowShareModal(false)} />
      )}
    </div>
  )
}

export default RecipeDetail