import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Settings, Home, PlusCircle, ShoppingCart, Calendar } from 'lucide-react'
import ChangelogModal from './ChangelogModal.js'

interface LayoutProps {
  children: React.ReactNode
}

interface LastUpdated {
  date: string
  time: string
}

const navItems = [
  { path: '/', label: 'Rezepte', icon: <Home size={20} /> },
  { path: '/extract', label: 'Extrahiere', icon: <PlusCircle size={20} /> },
  { path: '/shopping', label: 'Einkauf', icon: <ShoppingCart size={20} /> },
  { path: '/planner', label: 'Planer', icon: <Calendar size={20} /> },
  { path: '/settings', label: 'Einstellungen', icon: <Settings size={20} /> },
]

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation()
  const [showChangelog, setShowChangelog] = useState(false)
  const [currentVersion, setCurrentVersion] = useState('')
  const [lastUpdated, setLastUpdated] = useState<LastUpdated | null>(null)

  useEffect(() => {
    fetch('/changelog.json')
      .then(r => r.json())
      .then(data => {
        setCurrentVersion(data.version ?? '')
        setLastUpdated(data.lastUpdated ?? null)
      })
      .catch(() => {})
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-cream text-espresso">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-warmgray/20 bg-cream/95 backdrop-blur-sm flex-shrink-0">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <img src="/Logo.svg" alt="RecipeDeck" className="h-8 w-8" />
              <h1 className="hidden sm:block text-2xl font-display font-bold">RecipeDeck</h1>
            </div>

            <div className="flex items-center space-x-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                    location.pathname === item.path
                      ? 'bg-paprika/10 text-paprika shadow-sm'
                      : 'hover:bg-warmgray/5 text-warmgray hover:text-espresso'
                  } transform hover:scale-[1.02] active:scale-[0.98]`}
                  aria-current={location.pathname === item.path ? 'page' : undefined}
                >
                  {item.icon}
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              ))}

            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-warmgray/10 py-6 flex-shrink-0">
        <div className="container mx-auto px-4 text-center text-warmgray/50 text-xs tracking-wide space-y-1">
          <div>RecipeDeck — Rezepte aus dem Netz</div>
          {currentVersion && lastUpdated && (
            <div>
              v{currentVersion} · Zuletzt aktualisiert: {lastUpdated.date} um {lastUpdated.time} Uhr
            </div>
          )}
        </div>
      </footer>

      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}
    </div>
  )
}

export default Layout
