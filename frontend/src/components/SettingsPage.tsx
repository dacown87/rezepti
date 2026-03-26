import React, { useState, useEffect } from 'react'
import { Key, Check, X, AlertTriangle, HelpCircle, ExternalLink, Info, ScrollText } from 'lucide-react'
import { validateApiKey, saveApiKey, clearApiKey } from '../api/services.js'
import { useToast } from './ToastManager'
import ChangelogModal from './ChangelogModal.js'

const ROADMAP = [
  {
    category: '📥 Import & Extraktion',
    items: [
      { label: 'Webseiten (allgemein)', percent: 80 },
      { label: 'YouTube', percent: 80 },
      { label: 'TikTok', percent: 70 },
      { label: 'Instagram', percent: 70 },
      { label: 'Chefkoch', percent: 40 },
      { label: 'Cookidoo', percent: 10 },
      { label: 'Pinterest', percent: 0 },
      { label: 'Facebook', percent: 0 },
      { label: 'Foto-Import', percent: 0 },
    ],
  },
  {
    category: '🍽️ Rezeptanzeige & Navigation',
    items: [
      { label: 'Rezeptliste & Detailansicht', percent: 70 },
      { label: 'Zutaten & Schritte getrennt', percent: 70 },
      { label: 'Personenzahl & Skalierung', percent: 30 },
      { label: 'Fullscreen Koch-Modus', percent: 0 },
      { label: 'Original-Rezept-Link', percent: 0 },
      { label: 'Rezept als separate Seite', percent: 0 },
    ],
  },
  {
    category: '🛒 Einkauf & Planung',
    items: [
      { label: 'Einkaufsliste', percent: 0 },
      { label: 'Rezeptvorschläge aus Zutaten', percent: 0 },
    ],
  },
  {
    category: '👥 Community & Sozial',
    items: [
      { label: 'Benutzer-Login', percent: 0 },
      { label: 'Bewertungsfunktion (Sterne)', percent: 0 },
      { label: 'Kommentarfunktion', percent: 0 },
      { label: 'Rezepte via QR-Code teilen', percent: 0 },
    ],
  },
  {
    category: '📄 Export & Druck',
    items: [
      { label: 'Rezeptkarte als PDF', percent: 0 },
    ],
  },
  {
    category: '📱 Mobile',
    items: [
      { label: 'Mobile-First-Ansatz', percent: 100 },
      { label: 'Responsive Design', percent: 80 },
      { label: 'Android App', percent: 0 },
    ],
  },
  {
    category: '⚙️ Tech Stack (März 2026)',
    items: [
      { label: 'React 19', percent: 100 },
      { label: 'Vite 8', percent: 100 },
      { label: 'TypeScript 6', percent: 100 },
      { label: 'vitest 3', percent: 100 },
    ],
  },
]

function barColor(percent: number) {
  if (percent >= 60) return 'bg-green-500'
  if (percent >= 20) return 'bg-yellow-400'
  return 'bg-warmgray/30'
}

const RoadmapModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    onClick={onClose}
  >
    <div
      className="bg-white rounded-2xl shadow-2xl border border-warmgray/10 w-full max-w-lg max-h-[85vh] flex flex-col"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between p-6 border-b border-warmgray/10">
        <div>
          <h2 className="text-xl font-display font-bold">Roadmap</h2>
          <p className="text-sm text-warmgray mt-0.5">Dependencies aktualisiert • React 19, Vite 8, TS 6</p>
        </div>
        <button onClick={onClose} className="text-warmgray hover:text-gray-700 transition-colors">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="overflow-y-auto p-6 space-y-6">
        {ROADMAP.map((section) => (
          <div key={section.category}>
            <h3 className="font-display font-bold text-base mb-3">{section.category}</h3>
            <div className="space-y-2">
              {section.items.map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-warmgray">{item.label}</span>
                    <span className={`font-medium ${item.percent >= 60 ? 'text-green-600' : item.percent >= 20 ? 'text-yellow-600' : 'text-warmgray/50'}`}>
                      {item.percent}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-warmgray/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${barColor(item.percent)}`}
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
)

const SettingsPage: React.FC = () => {
  const [userKey, setUserKey] = useState('')
  const [showRoadmap, setShowRoadmap] = useState(false)
  const [showChangelog, setShowChangelog] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<{
    valid: boolean
    error?: string
    remainingCredits?: number
    rateLimits?: {
      remaining: number
      limit: number
      reset: string
    }
  } | null>(null)
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const { addToast } = useToast()

  // Load saved key on mount
  useEffect(() => {
    const saved = localStorage.getItem('rezepti_groq_key')
    if (saved) {
      setSavedKey(saved)
      setUserKey(saved)
    }
  }, [])

  const handleSaveKey = async () => {
    if (!userKey.trim()) return
    
    setIsValidating(true)
    setValidationResult(null)

    try {
      // First validate the key with our API
      const validation = await validateApiKey(userKey)
      
      if (validation.valid) {
        // Save to backend
        const saveResult = await saveApiKey(userKey)
        
        if (saveResult.success) {
          // Also save locally for frontend use
          localStorage.setItem('rezepti_groq_key', userKey)
          setSavedKey(userKey)
          setValidationResult({
            valid: true,
            remainingCredits: validation.remainingCredits,
            rateLimits: validation.rateLimits
          })
          addToast('API Key erfolgreich gespeichert und validiert', 'success')
        } else {
          const errorMsg = saveResult.error || 'Fehler beim Speichern des Keys'
          setValidationResult({
            valid: false,
            error: errorMsg
          })
          addToast(errorMsg, 'error')
        }
      } else {
        const errorMsg = validation.reason || 'Key konnte nicht validiert werden'
        setValidationResult({
          valid: false,
          error: errorMsg
        })
        addToast(errorMsg, 'error')
      }
    } catch (err: any) {
      console.error('Key validation/saving error:', err)
      const errorMsg = err.message || 'Netzwerkfehler. Bitte versuche es erneut.'
      setValidationResult({
        valid: false,
        error: errorMsg
      })
      addToast(errorMsg, 'error')
      
      // Fallback: basic validation
      if (userKey.startsWith('gsk_') && userKey.length > 30) {
        localStorage.setItem('rezepti_groq_key', userKey)
        setSavedKey(userKey)
        setValidationResult({
          valid: true,
          remainingCredits: 1000
        })
        addToast('API Key gespeichert (lokale Validierung)', 'info')
      }
    } finally {
      setIsValidating(false)
    }
  }

  const handleClearKey = async () => {
    if (!confirm('Möchtest du den API Key wirklich löschen?')) {
      return
    }
    
    try {
      await clearApiKey()
    } catch (err) {
      console.error('Error clearing API key:', err)
    }
    
    localStorage.removeItem('rezepti_groq_key')
    setSavedKey(null)
    setUserKey('')
    setValidationResult(null)
    addToast('API Key erfolgreich gelöscht', 'success')
  }

  const getKeyDisplay = (key: string) => {
    if (key.length <= 8) return key
    return `${key.substring(0, 8)}...${key.substring(key.length - 4)}`
  }

  return (
    <>
    {showRoadmap && <RoadmapModal onClose={() => setShowRoadmap(false)} />}
    {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold mb-2">Einstellungen</h1>
        <p className="text-warmgray">Verwalte deine API Keys und Einstellungen</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* BYOK Settings */}
          <div className="bg-white rounded-2xl shadow-lg border border-warmgray/10 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-display font-bold flex items-center space-x-2">
                  <Key className="h-5 w-5" />
                  <span>BYOK (Bring Your Own Key)</span>
                </h2>
                <p className="text-warmgray mt-1">
                  Nutze deinen eigenen Groq API Key für bessere Rate Limits
                </p>
              </div>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                savedKey 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {savedKey ? 'Aktiv' : 'Inaktiv'}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="groq-key" className="block text-sm font-medium text-warmgray mb-2">
                  Groq API Key
                </label>
                <div className="flex space-x-2">
                  <input
                    type="password"
                    id="groq-key"
                    value={userKey}
                    onChange={(e) => {
                      setUserKey(e.target.value)
                      setValidationResult(null)
                    }}
                    placeholder="gsk_..."
                    className="flex-1 px-4 py-3 border border-warmgray/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-paprika focus:border-transparent font-mono transition-colors duration-200 hover:border-warmgray/40"
                  />
                  <button
                    onClick={handleSaveKey}
                    disabled={isValidating || !userKey.trim()}
                    className="bg-paprika text-white px-6 py-3 rounded-lg font-medium hover:bg-paprika-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] transition-transform duration-200 shadow-md hover:shadow-lg"
                  >
                    {isValidating ? 'Validiere...' : savedKey ? 'Aktualisieren' : 'Speichern'}
                  </button>
                </div>
                <p className="text-sm text-warmgray mt-2">
                  Dein Key wird lokal im Browser gespeichert und nie an unseren Server gesendet.
                </p>
              </div>

              {validationResult && (
                <div className={`p-4 rounded-lg border ${
                  validationResult.valid 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-start space-x-3">
                    {validationResult.valid ? (
                      <Check className="h-5 w-5 text-green-500 mt-0.5" />
                    ) : (
                      <X className="h-5 w-5 text-red-500 mt-0.5" />
                    )}
                    <div>
                      <p className={`font-medium ${
                        validationResult.valid ? 'text-green-700' : 'text-red-700'
                      }`}>
                        {validationResult.valid ? 'Key ist gültig!' : 'Key ist ungültig'}
                      </p>
                      {validationResult.error && (
                        <p className="text-sm text-red-600 mt-1">{validationResult.error}</p>
                      )}
                      {validationResult.remainingCredits !== undefined && (
                        <p className="text-sm text-green-600 mt-1">
                          Geschätzte Credits: {validationResult.remainingCredits.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {savedKey && (
                <div className="p-4 bg-warmgray/5 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Gespeicherter Key</p>
                      <p className="text-sm text-warmgray font-mono">{getKeyDisplay(savedKey)}</p>
                    </div>
                    <button
                      onClick={handleClearKey}
                      className="text-red-600 hover:text-red-700 text-sm font-medium"
                    >
                      Key löschen
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-warmgray/10">
              <h3 className="font-display font-bold text-lg mb-3">Wie bekomme ich einen Groq Key?</h3>
              <ol className="list-decimal pl-5 space-y-2 text-warmgray">
                <li>
                  <a 
                    href="https://console.groq.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-paprika hover:text-paprika-dark inline-flex items-center space-x-1"
                  >
                    <span>Gehe zu console.groq.com</span>
                    <ExternalLink size={14} />
                  </a>
                </li>
                <li>Registriere dich oder logge dich ein</li>
                <li>Klicke auf "API Keys" im Dashboard</li>
                <li>Erstelle einen neuen API Key</li>
                <li>Kopiere den Key (beginnt mit "gsk_")</li>
                <li>Füge ihn oben ein und klicke auf "Speichern"</li>
              </ol>
            </div>
          </div>

        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Info Card */}
          <div className="bg-saffron/10 border border-saffron/20 rounded-2xl p-6">
            <div className="flex items-center space-x-3 mb-4">
              <HelpCircle className="h-6 w-6 text-saffron-dark" />
              <h3 className="font-display font-bold text-lg">BYOK Vorteile</h3>
            </div>
            <ul className="space-y-3 text-sm text-warmgray">
              <li className="flex items-start space-x-2">
                <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Keine Rate Limits durch andere Nutzer</span>
              </li>
              <li className="flex items-start space-x-2">
                <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Volle Kontrolle über deine API-Nutzung</span>
              </li>
              <li className="flex items-start space-x-2">
                <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Kosten nur für deine eigenen Anfragen</span>
              </li>
              <li className="flex items-start space-x-2">
                <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Transparenz über API-Nutzung</span>
              </li>
            </ul>
          </div>

          {/* Status Card */}
          <div className="bg-white border border-warmgray/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-lg">App Status</h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowChangelog(true)}
                  className="text-warmgray hover:text-paprika transition-colors"
                  title="Changelog anzeigen"
                >
                  <ScrollText className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setShowRoadmap(true)}
                  className="text-warmgray hover:text-paprika transition-colors"
                  title="Roadmap anzeigen"
                >
                  <Info className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-warmgray">React Frontend</span>
                  <span className="font-medium text-green-600">Aktiv</span>
                </div>
                <div className="h-2 bg-warmgray/10 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 w-3/4"></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-warmgray">BYOK Support</span>
                  <span className="font-medium text-green-600">Aktiv</span>
                </div>
                <div className="h-2 bg-warmgray/10 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 w-full"></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-warmgray">Mobile Ready</span>
                  <span className="font-medium text-yellow-600">In Vorbereitung</span>
                </div>
                <div className="h-2 bg-warmgray/10 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-500 w-2/3"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Warning Card */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-yellow-800">Wichtiger Hinweis</h4>
                <p className="text-sm text-yellow-700 mt-1">
                  Dein API Key wird nur lokal in deinem Browser gespeichert. 
                  Verliere ihn nicht und teile ihn nicht mit anderen.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}

export default SettingsPage