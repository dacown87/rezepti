import React from 'react'
import { ChefHat, Clock, Users, Flame } from 'lucide-react'

const RecipeList: React.FC = () => {
  // Temporary mock data
  const recipes = [
    {
      id: 1,
      name: 'Pasta Carbonara',
      emoji: '🍝',
      duration: 'mittel',
      servings: '4 Portionen',
      calories: 450,
      tags: ['Pasta', 'Italienisch', 'Schnell'],
    },
    {
      id: 2,
      name: 'Gemüsecurry',
      emoji: '🍛',
      duration: 'mittel',
      servings: '3 Portionen',
      calories: 320,
      tags: ['Vegan', 'Asiatisch', 'Scharf'],
    },
    {
      id: 3,
      name: 'Apfelstrudel',
      emoji: '🥧',
      duration: 'lang',
      servings: '8 Stücke',
      calories: 280,
      tags: ['Dessert', 'Österreichisch', 'Backen'],
    },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold mb-2">Deine Rezepte</h1>
        <p className="text-warmgray">Gespeicherte Rezepte aus dem Netz</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {recipes.map((recipe) => (
          <div
            key={recipe.id}
            className="bg-white rounded-2xl shadow-lg border border-warmgray/10 overflow-hidden hover:shadow-xl transition-shadow"
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <span className="text-3xl">{recipe.emoji}</span>
                  <div>
                    <h3 className="font-display font-bold text-xl">{recipe.name}</h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {recipe.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 bg-paprika/10 text-paprika text-xs rounded-full"
                        >
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
                    <span className="text-sm font-medium">{recipe.servings}</span>
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
                <button className="flex-1 bg-paprika text-white py-2 px-4 rounded-lg font-medium hover:bg-paprika-dark transition-colors">
                  Öffnen
                </button>
                <button className="px-4 py-2 border border-warmgray/20 rounded-lg hover:bg-warmgray/5 transition-colors">
                  Bearbeiten
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Empty state card */}
        <div className="bg-white rounded-2xl shadow-lg border border-warmgray/10 border-dashed p-8 text-center flex flex-col items-center justify-center">
          <ChefHat className="h-12 w-12 text-warmgray/40 mb-4" />
          <h3 className="font-display font-bold text-xl mb-2">Keine Rezepte</h3>
          <p className="text-warmgray mb-4">
            Extrahiere dein erstes Rezept aus YouTube, Instagram oder einer Webseite
          </p>
          <button className="bg-saffron text-espresso py-2 px-6 rounded-lg font-medium hover:bg-saffron-light transition-colors">
            Rezept extrahieren
          </button>
        </div>
      </div>

      <div className="mt-12 p-6 bg-saffron/10 rounded-2xl border border-saffron/20">
        <div className="flex items-center space-x-4">
          <div className="bg-saffron/20 p-3 rounded-full">
            <ChefHat className="h-6 w-6 text-saffron-dark" />
          </div>
          <div>
            <h3 className="font-display font-bold text-lg">React Migration läuft!</h3>
            <p className="text-warmgray">
              Diese React Version ist noch in Entwicklung. BYOK Support und mobile Vorbereitung kommen bald.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RecipeList