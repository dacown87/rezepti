import React, { useState, useEffect } from 'react'
import { ShoppingCart, Trash2, Check, Plus, Clipboard, X, ChevronRight, BookOpen } from 'lucide-react'
import { getShoppingList, toggleShoppingItem, deleteShoppingItem, clearCheckedItems, clearAllShoppingItems, getRecipes, addShoppingItem } from '../api/services.js'
import type { ShoppingItem, Recipe } from '../api/types.js'
import { useToast } from './ToastManager'
import { extractIngredientName } from '../utils/scaling.js'

const ShoppingPage: React.FC = () => {
  const [items, setItems] = useState<ShoppingItem[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddFromRecipe, setShowAddFromRecipe] = useState(false)
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(null)
  const { addToast } = useToast()

  useEffect(() => {
    const init = async () => {
      await loadData()

      const pendingData = localStorage.getItem('pendingShoppingItems')
      if (!pendingData) return
      try {
        const { recipeId, ingredients } = JSON.parse(pendingData)
        localStorage.removeItem('pendingShoppingItems')

        const newItems: ShoppingItem[] = []
        for (const ingredient of ingredients) {
          const canonicalName = extractIngredientName(ingredient)
          try {
            const result = await addShoppingItem(recipeId, canonicalName)
            newItems.push({
              id: result.id,
              recipe_id: recipeId,
              canonical_name: canonicalName,
              quantity: undefined,
              unit: undefined,
              checked: false,
              created_at: new Date().toISOString()
            })
          } catch {}
        }
        if (newItems.length > 0) {
          setItems(prev => [...newItems, ...prev])
          addToast(`${newItems.length} Zutaten aus Rezept hinzugefügt`, 'success')
        }
      } catch {}
    }
    init()
  }, [])

  const loadData = async () => {
    try {
      const [shoppingData, recipesData] = await Promise.all([
        getShoppingList(),
        getRecipes()
      ])
      setItems(shoppingData.items)
      setRecipes(recipesData)
    } catch (error) {
      console.error('Failed to load data:', error)
      addToast('Fehler beim Laden der Daten', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (id: number) => {
    try {
      await toggleShoppingItem(id)
      setItems(items.map(item => 
        item.id === id ? { ...item, checked: !item.checked } : item
      ))
    } catch (error) {
      console.error('Failed to toggle item:', error)
      addToast('Fehler beim Aktualisieren', 'error')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteShoppingItem(id)
      setItems(items.filter(item => item.id !== id))
      addToast('Element gelöscht', 'success')
    } catch (error) {
      console.error('Failed to delete item:', error)
      addToast('Fehler beim Löschen', 'error')
    }
  }

  const handleClearChecked = async () => {
    if (!confirm('Alle erledigten Einträge löschen?')) return
    try {
      await clearCheckedItems()
      setItems(items.filter(item => !item.checked))
      addToast('Erledigte Einträge gelöscht', 'success')
    } catch (error) {
      console.error('Failed to clear checked:', error)
      addToast('Fehler beim Löschen', 'error')
    }
  }

  const handleClearAll = async () => {
    if (!confirm('Die gesamte Einkaufsliste löschen?')) return
    try {
      await clearAllShoppingItems()
      setItems([])
      addToast('Einkaufsliste geleert', 'success')
    } catch (error) {
      console.error('Failed to clear all:', error)
      addToast('Fehler beim Löschen', 'error')
    }
  }

  const handleAddFromRecipe = async () => {
    if (!selectedRecipeId) return
    
    const recipe = recipes.find(r => r.id === selectedRecipeId)
    if (!recipe) return

    try {
      const newItems: ShoppingItem[] = []
      for (const ingredient of recipe.ingredients) {
        const canonicalName = extractIngredientName(ingredient)
        const result = await addShoppingItem(recipe.id, canonicalName)
        newItems.push({
          id: result.id,
          recipe_id: recipe.id,
          canonical_name: canonicalName,
          quantity: undefined,
          unit: undefined,
          checked: false,
          created_at: new Date().toISOString()
        })
      }
      setItems([...items, ...newItems])
      setShowAddFromRecipe(false)
      setSelectedRecipeId(null)
      addToast(`${recipe.ingredients.length} Zutaten hinzugefügt`, 'success')
    } catch (error) {
      console.error('Failed to add from recipe:', error)
      addToast('Fehler beim Hinzufügen', 'error')
    }
  }

  const handleCopyToClipboard = () => {
    const unchecked = items.filter(item => !item.checked)
    const text = unchecked.map(item => {
      const qty = item.quantity ? `${item.quantity}${item.unit ? ' ' + item.unit : ''}` : ''
      return `${qty} ${item.canonical_name}`.trim()
    }).join('\n')
    
    navigator.clipboard.writeText(text)
    addToast('In die Zwischenablage kopiert!', 'success')
  }

  const formatItem = (item: ShoppingItem) => {
    const parts = []
    if (item.quantity) parts.push(item.quantity)
    if (item.unit) parts.push(item.unit)
    if (parts.length > 0) parts.push('—')
    parts.push(item.canonical_name)
    return parts.join(' ')
  }

  const checkedCount = items.filter(i => i.checked).length
  const uncheckedItems = items.filter(i => !i.checked)
  const checkedItems = items.filter(i => i.checked)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-paprika"></div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-3">
            <ShoppingCart className="h-8 w-8 text-paprika" />
            Einkaufsliste
          </h1>
          <p className="text-warmgray mt-1">
            {items.length === 0 
              ? 'Keine Einträge' 
              : `${uncheckedItems.length} offen${checkedCount > 0 ? `, ${checkedCount} erledigt` : ''}`
            }
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddFromRecipe(true)}
            className="flex items-center gap-2 bg-paprika text-white px-4 py-2 rounded-lg hover:bg-paprika-dark transition-colors"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Aus Rezept</span>
          </button>
          {items.length > 0 && (
            <button
              onClick={handleCopyToClipboard}
              className="flex items-center gap-2 bg-warmgray/10 px-4 py-2 rounded-lg hover:bg-warmgray/20 transition-colors"
              title="In Zwischenablage kopieren"
            >
              <Clipboard size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Add from Recipe Modal */}
      {showAddFromRecipe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-display font-bold">Zutaten hinzufügen</h2>
              <button onClick={() => setShowAddFromRecipe(false)} className="text-warmgray hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            <p className="text-warmgray mb-4">Wähle ein Rezept aus:</p>
            <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
              {recipes.map(recipe => (
                <button
                  key={recipe.id}
                  onClick={() => setSelectedRecipeId(recipe.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                    selectedRecipeId === recipe.id
                      ? 'border-paprika bg-paprika/5'
                      : 'border-warmgray/20 hover:border-warmgray/40'
                  }`}
                >
                  <span className="mr-2">{recipe.emoji}</span>
                  {recipe.name}
                </button>
              ))}
            </div>
            <button
              onClick={handleAddFromRecipe}
              disabled={!selectedRecipeId}
              className="w-full bg-paprika text-white py-3 rounded-lg font-medium hover:bg-paprika-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Hinzufügen
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      {items.length > 0 && (
        <div className="flex gap-2 mb-6">
          {checkedCount > 0 && (
            <button
              onClick={handleClearChecked}
              className="text-sm text-warmgray hover:text-paprika transition-colors"
            >
              Erledigte löschen
            </button>
          )}
          <button
            onClick={handleClearAll}
            className="text-sm text-warmgray hover:text-red-600 transition-colors"
          >
            Liste leeren
          </button>
        </div>
      )}

      {/* Items */}
      {items.length === 0 ? (
        <div className="text-center py-16 bg-warmgray/5 rounded-2xl">
          <ShoppingCart className="h-16 w-16 text-warmgray/30 mx-auto mb-4" />
          <p className="text-warmgray mb-4">Deine Einkaufsliste ist leer</p>
          <button
            onClick={() => setShowAddFromRecipe(true)}
            className="text-paprika hover:text-paprika-dark font-medium"
          >
            Zutaten aus einem Rezept hinzufügen
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {uncheckedItems.map(item => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-4 bg-white rounded-xl border border-warmgray/10 hover:border-warmgray/20 transition-colors"
            >
              <button
                onClick={() => handleToggle(item.id)}
                className="w-6 h-6 rounded-full border-2 border-warmgray/30 hover:border-green-500 flex items-center justify-center transition-colors"
              />
              <span className="flex-1">{formatItem(item)}</span>
              <button
                onClick={() => handleDelete(item.id)}
                className="text-warmgray hover:text-red-600 transition-colors p-1"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}

          {checkedItems.length > 0 && (
            <>
              <p className="text-xs text-warmgray uppercase tracking-wide pt-4 pb-1">Erledigt</p>
              {checkedItems.map(item => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-4 bg-white rounded-xl border border-warmgray/10 opacity-50 transition-colors"
                >
                  <button
                    onClick={() => handleToggle(item.id)}
                    className="w-6 h-6 rounded-full border-2 bg-green-500 border-green-500 text-white flex items-center justify-center transition-colors"
                  >
                    <Check size={14} />
                  </button>
                  <span className="flex-1 line-through text-warmgray">{formatItem(item)}</span>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-warmgray hover:text-red-600 transition-colors p-1"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default ShoppingPage
