import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, Users, Flame, Edit, Trash2, ChefHat, Loader2, AlertCircle, ExternalLink } from 'lucide-react'
import { getRecipe, deleteRecipe } from '../api/services.js'
import type { Recipe } from '../api/types.js'
import { useToast } from './ToastManager'
import { RecipeDetailSkeleton } from './SkeletonLoader'

const RecipeDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
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
    if (!recipe || !confirm('Möchtest du dieses Rezept wirklich löschen?')) {
      return
    }
    
    setIsDeleting(true)
    
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
            <div className="flex items-center space-x-3 mb-2">
              <span className="text-4xl">{recipe.emoji}</span>
              <h1 className="text-3xl md:text-4xl font-display font-bold">{recipe.name}</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              {recipe.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="text-center p-4 bg-cream rounded-xl">
              <div className="flex items-center justify-center space-x-2 text-warmgray mb-2">
                <Clock size={20} />
                <span className="font-medium">{recipe.duration}</span>
              </div>
              <div className="text-sm text-warmgray">Dauer</div>
            </div>
            
            <div className="text-center p-4 bg-cream rounded-xl">
              <div className="flex items-center justify-center space-x-2 text-warmgray mb-2">
                <Users size={20} />
                <span className="font-medium">{recipe.servings}</span>
              </div>
              <div className="text-sm text-warmgray">Portionen</div>
            </div>
            
            <div className="text-center p-4 bg-cream rounded-xl">
              <div className="flex items-center justify-center space-x-2 text-warmgray mb-2">
                <Flame size={20} />
                <span className="font-medium">{recipe.calories} kcal</span>
              </div>
              <div className="text-sm text-warmgray">Pro Portion</div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex space-x-3 mb-8">
            <button className="flex-1 bg-paprika text-white py-3 px-6 rounded-lg font-medium hover:bg-paprika-dark transition-colors flex items-center justify-center space-x-2 transform hover:scale-[1.02] active:scale-[0.98] transition-transform duration-200 shadow-md hover:shadow-lg">
              <Edit size={20} />
              <span>Rezept bearbeiten</span>
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-6 py-3 border border-red-300 text-red-600 rounded-lg font-medium hover:bg-red-50 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] transition-transform duration-200"
            >
              <Trash2 size={20} className={isDeleting ? 'animate-spin' : ''} />
              <span>{isDeleting ? 'Löschen...' : 'Löschen'}</span>
            </button>
            {recipe.source_url && (
              <a
                href={recipe.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-3 border border-warmgray/20 text-warmgray rounded-lg font-medium hover:bg-warmgray/5 transition-colors flex items-center space-x-2"
                title="Original-Rezept öffnen"
              >
                <ExternalLink size={20} />
                <span className="hidden sm:inline">Zum Original</span>
              </a>
            )}
          </div>

          {/* Ingredients */}
          <div className="mb-8">
            <h2 className="text-2xl font-display font-bold mb-4">Zutaten</h2>
            <ul className="space-y-2">
              {recipe.ingredients.map((ingredient, index) => (
                <li key={index} className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-paprika rounded-full mt-2.5"></div>
                  <span className="text-warmgray">{ingredient}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Steps */}
          <div>
            <h2 className="text-2xl font-display font-bold mb-4">Zubereitung</h2>
            <ol className="space-y-6">
              {recipe.steps.map((step, index) => (
                <li key={index} className="flex space-x-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-paprika text-white rounded-full flex items-center justify-center font-bold">
                    {index + 1}
                  </div>
                  <div className="pt-1">
                    <p className="text-warmgray">{step}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      {/* Source info */}
      {recipe.source_url && (
        <div className="bg-white rounded-2xl shadow-lg border border-warmgray/10 p-6 mb-8">
          <h3 className="font-display font-bold text-lg mb-3">Quelle</h3>
          <div className="flex items-center justify-between">
            <a
              href={recipe.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-paprika hover:text-paprika-dark font-medium truncate"
            >
              {recipe.source_url}
            </a>
            <span className="text-sm text-warmgray">
              Extrahiert am {new Date(recipe.created_at).toLocaleDateString('de-DE')}
            </span>
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
    </div>
  )
}

export default RecipeDetail