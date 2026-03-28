import React, { useState, useEffect } from 'react'
import { Calendar, ChevronLeft, ChevronRight, Plus, Trash2, ShoppingCart, ChefHat, Camera, ScanLine } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getMealPlan, addToMealPlan, removeFromMealPlan, clearMealPlan, getRecipes, addShoppingItem } from '../api/services.js'
import type { MealPlanEntry, Recipe } from '../api/types.js'
import { useToast } from './ToastManager'

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const DAY_NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']

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
  const [isGeneratingShopping, setIsGeneratingShopping] = useState(false)
  const [activeTab, setActiveTab] = useState<'planner' | 'scan'>('planner')
  const { addToast } = useToast()

  useEffect(() => {
    loadData()
  }, [weekStart])

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

  const getRecipeById = (id: number) => recipes.find(r => r.id === id)

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
            onClick={() => setActiveTab(activeTab === 'planner' ? 'scan' : 'planner')}
            className="flex items-center gap-2 bg-paprika text-white px-4 py-2 rounded-lg hover:bg-paprika-dark transition-colors"
          >
            <ScanLine size={18} />
            <span className="hidden sm:inline">QR</span>
          </button>
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

      {activeTab === 'planner' && (
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
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {DAYS.map((day, index) => {
          const dayRecipes = getRecipesForDay(index)
          return (
            <div
              key={index}
              className={`bg-white rounded-xl border border-warmgray/10 min-h-[180px] flex flex-col ${
                index === 5 || index === 6 ? 'md:border-saffron/30 md:bg-saffron/5' : ''
              }`}
            >
              <div className={`p-3 text-center border-b border-warmgray/10 ${
                index === 5 || index === 6 ? 'bg-saffron/10' : ''
              }`}>
                <div className="font-medium">{day}</div>
                <div className="text-xs text-warmgray">{DAY_NAMES[index]}</div>
              </div>
              
              <div className="flex-1 p-2 space-y-2">
                {dayRecipes.map(entry => {
                  const recipe = getRecipeById(entry.recipe_id)
                  return (
                    <div
                      key={entry.id}
                      className="group bg-warmgray/5 rounded-lg p-2 text-sm flex items-center justify-between"
                    >
                      <span className="truncate flex-1">
                        {recipe ? `${recipe.emoji} ${recipe.name}` : `Rezept #${entry.recipe_id}`}
                      </span>
                      <button
                        onClick={() => handleRemoveRecipe(entry.id)}
                        className="opacity-0 group-hover:opacity-100 text-warmgray hover:text-red-500 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )
                })}
              </div>

              <button
                onClick={() => setShowAddModal(index)}
                className="m-2 p-2 text-warmgray/50 hover:text-paprika hover:bg-paprika/5 rounded-lg transition-colors text-xs flex items-center justify-center gap-1"
              >
                <Plus size={14} />
                <span className="hidden sm:inline">Rezept</span>
              </button>
            </div>
          )
        })}
      </div>

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
      )}

      {/* Add Recipe Modal */}
      {showAddModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-display font-bold">Rezept hinzufügen</h2>
              <button onClick={() => setShowAddModal(null)} className="text-warmgray hover:text-gray-700">
                ×
              </button>
            </div>
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
          </div>
        </div>
      )}
    </div>
  )
}

export default PlannerPage