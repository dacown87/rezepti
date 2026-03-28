import React, { useState, useEffect } from 'react'
import { ChefHat, Clock, Users, Flame, RefreshCw, LayoutGrid, List, Star, Search, X, Download } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getRecipes } from '../api/services.js'
import { parseServingsNumber } from '../utils/scaling.js'
import { generateRecipeCardsPDF, downloadPDF } from '../utils/pdf-export.js'
import type { Recipe } from '../api/types.js'
import { useToast } from './ToastManager'
import { RecipeListSkeleton } from './SkeletonLoader'

type ViewMode = 'list' | 'grid'

const RecipeList: React.FC = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem('rezepti_view_mode') as ViewMode) ?? 'list'
  )
  const [ingredientSearch, setIngredientSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const { addToast } = useToast()
  const [isExportingCards, setIsExportingCards] = useState(false)

  const switchView = (mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem('rezepti_view_mode', mode)
  }

  useEffect(() => {
    fetchRecipes()
  }, [])

  const fetchRecipes = async (showToast = false, ingredients?: string[]): Promise<void> => {
    if (!showToast) {
      setIsLoading(true)
    } else {
      setIsRefreshing(true)
    }
    setError(null)
    
    try {
      const data = await getRecipes(ingredients)
      setRecipes(data)
      setIngredientSearch(ingredients ? ingredients.join(', ') : '')
      if (showToast && data.length > 0) {
        addToast(`${data.length} Rezepte geladen`, 'success')
      }
    } catch (err: any) {
      console.error('Failed to load recipes:', err)
      const errorMessage = 'Rezepte konnten nicht geladen werden. Bitte versuche es später erneut.'
      setError(errorMessage)
      addToast(errorMessage, 'error')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const handleSearch = () => {
    const terms = searchInput.split(',').map(t => t.trim()).filter(t => t)
    fetchRecipes(false, terms.length > 0 ? terms : undefined)
  }

  const clearSearch = () => {
    setSearchInput('')
    fetchRecipes(false, undefined)
  }

  const handleExportCards = async () => {
    if (recipes.length === 0) {
      addToast('Keine Rezepte zum Exportieren', 'error')
      return
    }
    setIsExportingCards(true)
    try {
      const blob = await generateRecipeCardsPDF(recipes)
      const filename = `rezeptkarten_${new Date().toISOString().split('T')[0]}.pdf`
      downloadPDF(blob, filename)
      addToast('PDF-Karteikarten heruntergeladen', 'success')
    } catch (error) {
      console.error('PDF export failed:', error)
      addToast('PDF konnte nicht erstellt werden', 'error')
    } finally {
      setIsExportingCards(false)
    }
  }

  const emptyState = (colSpan: string) => (
    <div className={`${colSpan} bg-white rounded-2xl shadow-lg border border-warmgray/10 border-dashed p-8 text-center flex flex-col items-center justify-center`}>
      <ChefHat className="h-12 w-12 text-warmgray/40 mb-4" />
      <h3 className="font-display font-bold text-xl mb-2">Keine Rezepte</h3>
      <p className="text-warmgray mb-4">
        {error || 'Extrahiere dein erstes Rezept aus YouTube, Instagram oder einer Webseite'}
      </p>
      <Link to="/extract" className="bg-saffron text-espresso py-2 px-6 rounded-lg font-medium hover:bg-saffron-light transition-colors">
        Rezept extrahieren
      </Link>
      {error && (
        <button onClick={() => fetchRecipes()} className="mt-3 text-paprika hover:text-paprika-dark text-sm font-medium">
          Erneut versuchen
        </button>
      )}
    </div>
  )

  return (
    <div>
      <div className="mb-8">
        {/* Ingredient search */}
        <div className="mb-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-warmgray/50" size={18} />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Ich habe: Eier, Butter, Mehl..."
                className="w-full pl-10 pr-4 py-2 border border-warmgray/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-paprika focus:border-transparent"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-paprika text-white rounded-lg hover:bg-paprika-dark transition-colors"
            >
              Suchen
            </button>
            {ingredientSearch && (
              <button
                onClick={clearSearch}
                className="px-3 py-2 text-warmgray hover:text-paprika transition-colors"
                title="Suche löschen"
              >
                <X size={18} />
              </button>
            )}
          </div>
          {ingredientSearch && (
            <p className="text-sm text-warmgray mt-2">
              Suche nach: <span className="font-medium text-paprika">{ingredientSearch}</span>
            </p>
          )}
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold mb-2">Deine Rezepte</h1>
            <p className="text-warmgray">Gespeicherte Rezepte aus dem Netz</p>
          </div>
          <div className="flex items-center space-x-2">
            {/* View toggle */}
            <div className="flex bg-warmgray/10 rounded-lg p-1">
              <button
                onClick={() => switchView('list')}
                className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow text-paprika' : 'text-warmgray hover:text-gray-600'}`}
                title="Listenansicht"
              >
                <List size={18} />
              </button>
              <button
                onClick={() => switchView('grid')}
                className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white shadow text-paprika' : 'text-warmgray hover:text-gray-600'}`}
                title="Kartenansicht"
              >
                <LayoutGrid size={18} />
              </button>
            </div>
            <button
              onClick={() => fetchRecipes(true)}
              disabled={isRefreshing}
              className="flex items-center space-x-2 px-4 py-2 bg-warmgray/10 hover:bg-warmgray/20 text-warmgray rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Rezepte aktualisieren"
            >
              <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Aktualisieren</span>
            </button>
            <button
              onClick={handleExportCards}
              disabled={isExportingCards || recipes.length === 0}
              className="flex items-center space-x-2 px-4 py-2 bg-saffron text-espresso rounded-lg hover:bg-saffron-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="PDF-Karteikarten exportieren"
            >
              <Download size={18} />
              <span className="hidden sm:inline">Karten</span>
            </button>
          </div>
        </div>
      </div>

      {/* List view */}
      {viewMode === 'list' && (
        <div className="space-y-2">
          {isLoading ? (
            <RecipeListSkeleton />
          ) : recipes.length > 0 ? (
            recipes.map((recipe) => (
              <Link
                key={recipe.id}
                to={`/recipe/${recipe.id}`}
                className="flex items-center bg-white rounded-xl border border-warmgray/10 px-4 py-3 hover:shadow-md hover:border-paprika/20 transition-all group"
              >
                <span className="text-2xl mr-4 flex-shrink-0">{recipe.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold text-base truncate group-hover:text-paprika transition-colors">
                    {recipe.name}
                  </p>
                  <div className="flex flex-wrap items-center gap-1 mt-1">
                    {recipe.tags?.slice(0, 3).map((tag) => (
                      <span key={tag} className="px-2 py-0.5 bg-paprika/10 text-paprika text-xs rounded-full">
                        {tag}
                      </span>
                    ))}
                    {recipe.rating && (
                      <div className="flex items-center space-x-0.5 ml-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            size={11}
                            className={s <= recipe.rating! ? 'text-saffron' : 'text-warmgray/20'}
                            fill={s <= recipe.rating! ? 'currentColor' : 'none'}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="hidden sm:flex items-center space-x-5 ml-4 flex-shrink-0 text-warmgray text-sm">
                  {recipe.duration && (
                    <span className="flex items-center space-x-1">
                      <Clock size={14} />
                      <span>{recipe.duration}</span>
                    </span>
                  )}
                  {recipe.servings && (
                    <span className="flex items-center space-x-1">
                      <Users size={14} />
                      <span>{recipe.servings}</span>
                    </span>
                  )}
                  {recipe.calories && (
                    <span className="flex items-center space-x-1">
                      <Flame size={14} />
                      <span>{recipe.calories} kcal</span>
                    </span>
                  )}
                </div>
              </Link>
            ))
          ) : (
            emptyState('w-full')
          )}
        </div>
      )}

      {/* Grid view */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            <RecipeListSkeleton />
          ) : recipes.length > 0 ? (
            recipes.map((recipe) => (
              <div
                key={recipe.id}
                className="bg-white rounded-2xl shadow-lg border border-warmgray/10 overflow-hidden hover:shadow-xl transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <span className="text-3xl">{recipe.emoji}</span>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-display font-bold text-xl">{recipe.name}</h3>
                          {recipe.rating && (
                            <div className="flex items-center space-x-0.5">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  size={13}
                                  className={s <= recipe.rating! ? 'text-saffron' : 'text-warmgray/20'}
                                  fill={s <= recipe.rating! ? 'currentColor' : 'none'}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {recipe.tags?.map((tag) => (
                            <span key={tag} className="px-2 py-1 bg-paprika/10 text-paprika text-xs rounded-full">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-warmgray/10">
                    <div className="text-center">
                      <div className="flex items-center justify-center space-x-1 text-warmgray mb-1">
                        <Clock size={16} />
                        <span className="text-sm font-medium">{recipe.duration}</span>
                      </div>
                      <div className="text-xs text-warmgray">Dauer</div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center space-x-1 text-warmgray mb-1">
                        <Users size={16} />
                        <span className="text-sm font-medium">{parseServingsNumber(recipe.servings)}</span>
                      </div>
                      <div className="text-xs text-warmgray">Portionen</div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center space-x-1 text-warmgray mb-1">
                        <Flame size={16} />
                        <span className="text-sm font-medium">{recipe.calories}</span>
                      </div>
                      <div className="text-xs text-warmgray">kcal</div>
                    </div>
                  </div>
                  <div className="mt-6 flex space-x-3">
                    <Link
                      to={`/recipe/${recipe.id}`}
                      className="flex-1 bg-paprika text-white py-2 px-4 rounded-lg font-medium hover:bg-paprika-dark transition-colors text-center transform hover:scale-[1.02] active:scale-[0.98] transition-transform duration-200"
                    >
                      Öffnen
                    </Link>
                  </div>
                </div>
              </div>
            ))
          ) : (
            emptyState('lg:col-span-3')
          )}
        </div>
      )}
    </div>
  )
}

export default RecipeList