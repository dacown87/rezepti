import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChefHat, Settings, Home, PlusCircle } from 'lucide-react'

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation()

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
    </div>
  )
}

export default Layout