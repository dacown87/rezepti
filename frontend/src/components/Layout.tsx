import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChefHat, Settings, Home, PlusCircle, BookOpen, X } from 'lucide-react'

interface LayoutProps {
  children: React.ReactNode
}

const changelogs = [
  {
    version: '1.0.0',
    date: '25.03.2026',
    changes: [
      'Komplette React-Migration abgeschlossen',
      'Modernes Frontend mit Vite + TypeScript + Tailwind CSS',
      'BYOK Support - User können eigenen Groq Key verwenden',
      'Polling API für React Frontend optimiert',
      'Docker Deployment mit Multi-stage Build',
      'E2E Testing Suite (1000+ Zeilen)',
      'Unit Tests (254+ Tests)',
      'Neues UI Design mit Toast Notifications',
      'Import-Warnungen behoben',
      'Portionsgrößen-Skalierung mit +/- Buttons',
      'Rezept-Detailseite mit Quellen-Button',
      'Löschen mit Bestätigungsmodal',
    ],
  },
]

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation()
  const [showChangelog, setShowChangelog] = useState(false)

  const navItems = [
    { path: '/', label: 'Rezepte', icon: <Home size={20} /> },
    { path: '/extract', label: 'Extrahiere', icon: <PlusCircle size={20} /> },
    { path: '/settings', label: 'Einstellungen', icon: <Settings size={20} /> },
  ]

  return (
    <div className="min-h-screen bg-cream text-espresso">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-warmgray/20 bg-cream/95 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ChefHat className="h-8 w-8 text-paprika" />
              <h1 className="text-2xl font-display font-bold">Rezepti</h1>
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
              <button
                onClick={() => setShowChangelog(true)}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg hover:bg-warmgray/5 text-warmgray hover:text-espresso transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
                aria-label="Changelog anzeigen"
              >
                <BookOpen size={20} />
                <span className="hidden sm:inline">Changelog</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-warmgray/10 py-6 mt-12">
        <div className="container mx-auto px-4 text-center text-warmgray/50 text-xs tracking-wide">
          Rezepti — Rezepte aus dem Netz
        </div>
      </footer>

      {/* Changelog Modal */}
      {showChangelog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-warmgray/10">
              <h2 className="text-xl font-display font-bold">Changelog</h2>
              <button
                onClick={() => setShowChangelog(false)}
                className="p-2 hover:bg-warmgray/10 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-6">
              {changelogs.map((log) => (
                <div key={log.version} className="border-b border-warmgray/10 pb-4 last:border-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="bg-paprika text-white px-3 py-1 rounded-full text-sm font-bold">
                      {log.version}
                    </span>
                    <span className="text-warmgray text-sm">{log.date}</span>
                  </div>
                  <ul className="space-y-1">
                    {log.changes.map((change, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-warmgray">
                        <span className="w-1.5 h-1.5 bg-paprika rounded-full mt-1.5 flex-shrink-0" />
                        {change}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Layout