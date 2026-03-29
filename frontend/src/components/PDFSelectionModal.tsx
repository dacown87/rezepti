import React, { useState, useEffect } from 'react'
import { X, Download, Check, FileText } from 'lucide-react'
import type { Recipe } from '../api/types.js'
import { generateRecipeCardsPDF, downloadPDF } from '../utils/pdf-export.js'

interface PDFSelectionModalProps {
  recipes: Recipe[]
  onClose: () => void
}

const PDF_HISTORY_KEY = 'rezepti_pdf_history'

interface PDFHistoryEntry {
  recipeId: number
  recipeName: string
  createdAt: string
}

function getPDFHistory(): PDFHistoryEntry[] {
  try {
    const stored = localStorage.getItem(PDF_HISTORY_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function addToPDFHistory(recipeId: number, recipeName: string): void {
  const history = getPDFHistory()
  const existingIndex = history.findIndex(h => h.recipeId === recipeId)
  if (existingIndex >= 0) {
    history.splice(existingIndex, 1)
  }
  history.unshift({ recipeId, recipeName, createdAt: new Date().toISOString() })
  localStorage.setItem(PDF_HISTORY_KEY, JSON.stringify(history.slice(0, 100)))
}

function wasPDFCreated(recipeId: number): boolean {
  const history = getPDFHistory()
  return history.some(h => h.recipeId === recipeId)
}

const PDFSelectionModal: React.FC<PDFSelectionModalProps> = ({ recipes, onClose }) => {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    const notYetCreated = recipes.filter(r => !wasPDFCreated(r.id)).map(r => r.id)
    setSelectedIds(new Set(notYetCreated))
  }, [recipes])

  const toggleRecipe = (id: number) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const selectAll = () => setSelectedIds(new Set(recipes.map(r => r.id)))
  const selectNew = () => setSelectedIds(new Set(recipes.filter(r => !wasPDFCreated(r.id)).map(r => r.id)))
  const selectNone = () => setSelectedIds(new Set())

  const handleExport = async () => {
    if (selectedIds.size === 0) return
    setIsExporting(true)
    try {
      const selectedRecipes = recipes.filter(r => selectedIds.has(r.id))
      const blob = await generateRecipeCardsPDF(selectedRecipes)
      const filename = `rezeptkarten_${new Date().toISOString().split('T')[0]}.pdf`
      downloadPDF(blob, filename)
      
      for (const recipe of selectedRecipes) {
        addToPDFHistory(recipe.id, recipe.name)
      }
      
      onClose()
    } catch (error) {
      console.error('PDF export failed:', error)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <FileText className="text-paprika" size={24} />
            <h3 className="text-lg font-display font-bold">PDF-Karteikarten erstellen</h3>
          </div>
          <button
            onClick={onClose}
            className="text-warmgray/50 hover:text-warmgray transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={selectAll}
            className="flex-1 text-xs px-3 py-1.5 bg-warmgray/10 hover:bg-warmgray/20 text-warmgray rounded-lg transition-colors"
          >
            Alle
          </button>
          <button
            onClick={selectNew}
            className="flex-1 text-xs px-3 py-1.5 bg-saffron/10 hover:bg-saffron/20 text-saffron-dark rounded-lg transition-colors"
          >
            Neue
          </button>
          <button
            onClick={selectNone}
            className="flex-1 text-xs px-3 py-1.5 bg-warmgray/10 hover:bg-warmgray/20 text-warmgray rounded-lg transition-colors"
          >
            Keine
          </button>
        </div>

        <p className="text-sm text-warmgray mb-3">
          {selectedIds.size} von {recipes.length} ausgewählt
        </p>

        <div className="flex-1 overflow-y-auto space-y-2 mb-4">
          {recipes.map(recipe => {
            const created = wasPDFCreated(recipe.id)
            const isSelected = selectedIds.has(recipe.id)
            return (
              <label
                key={recipe.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  isSelected 
                    ? 'border-paprika bg-paprika/5' 
                    : 'border-warmgray/20 hover:border-warmgray/40'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleRecipe(recipe.id)}
                  className="w-5 h-5 rounded border-warmgray/30 text-paprika focus:ring-paprika"
                />
                <span className="text-xl">{recipe.emoji}</span>
                <span className="flex-1 truncate">{recipe.name}</span>
                {created && (
                  <span className="text-xs text-warmgray/50 flex items-center gap-1">
                    <Check size={12} />
                    Erstellt
                  </span>
                )}
              </label>
            )
          })}
        </div>

        <button
          onClick={handleExport}
          disabled={selectedIds.size === 0 || isExporting}
          className="flex items-center justify-center gap-2 w-full bg-saffron text-espresso py-3 px-6 rounded-lg font-medium hover:bg-saffron-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExporting ? (
            <div className="animate-spin w-5 h-5 border-2 border-espresso border-t-transparent rounded-full" />
          ) : (
            <Download size={20} />
          )}
          <span>{selectedIds.size} PDF{selectedIds.size !== 1 ? 's' : ''} erstellen</span>
        </button>
      </div>
    </div>
  )
}

export default PDFSelectionModal