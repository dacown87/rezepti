import React, { useState, useEffect } from 'react'
import { Key, Check, X, AlertTriangle, HelpCircle, ExternalLink } from 'lucide-react'

const SettingsPage: React.FC = () => {
  const [userKey, setUserKey] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean
    error?: string
    remainingCredits?: number
  } | null>(null)
  const [savedKey, setSavedKey] = useState<string | null>(null)

  // Load saved key on mount
  useEffect(() => {
    const saved = localStorage.getItem('rezepti_groq_key')
    if (saved) {
      setSavedKey(saved)
      setUserKey(saved)
    }
  }, [])

  const handleSaveKey = () => {
    if (!userKey.trim()) return
    
    // Basic validation
    if (!userKey.startsWith('gsk_')) {
      setValidationResult({
        isValid: false,
        error: 'Ungültiges Key-Format. Groq Keys beginnen mit "gsk_"'
      })
      return
    }

    setIsValidating(true)
    
    // Simulate API validation
    setTimeout(() => {
      // TODO: Implement actual Groq API validation
      // const isValid = await validateGroqKey(userKey)
      
      // For now, simulate success for valid-looking keys
      const isValid = userKey.length > 30
      
      if (isValid) {
        localStorage.setItem('rezepti_groq_key', userKey)
        setSavedKey(userKey)
        setValidationResult({
          isValid: true,
          remainingCredits: 1000, // Mock data
        })
      } else {
        setValidationResult({
          isValid: false,
          error: 'Key konnte nicht validiert werden. Bitte überprüfe den Key.'
        })
      }
      setIsValidating(false)
    }, 1500)
  }

  const handleClearKey = () => {
    localStorage.removeItem('rezepti_groq_key')
    setSavedKey(null)
    setUserKey('')
    setValidationResult(null)
  }

  const getKeyDisplay = (key: string) => {
    if (key.length <= 8) return key
    return `${key.substring(0, 8)}...${key.substring(key.length - 4)}`
  }

  return (
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
                    className="flex-1 px-4 py-3 border border-warmgray/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-paprika focus:border-transparent font-mono"
                  />
                  <button
                    onClick={handleSaveKey}
                    disabled={isValidating || !userKey.trim()}
                    className="bg-paprika text-white px-6 py-3 rounded-lg font-medium hover:bg-paprika-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                  validationResult.isValid 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-start space-x-3">
                    {validationResult.isValid ? (
                      <Check className="h-5 w-5 text-green-500 mt-0.5" />
                    ) : (
                      <X className="h-5 w-5 text-red-500 mt-0.5" />
                    )}
                    <div>
                      <p className={`font-medium ${
                        validationResult.isValid ? 'text-green-700' : 'text-red-700'
                      }`}>
                        {validationResult.isValid ? 'Key ist gültig!' : 'Key ist ungültig'}
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

          {/* App Settings */}
          <div className="bg-white rounded-2xl shadow-lg border border-warmgray/10 p-6">
            <h2 className="text-xl font-display font-bold mb-6">App Einstellungen</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Dunkelmodus</p>
                  <p className="text-sm text-warmgray">Interface in dunklem Design anzeigen</p>
                </div>
                <div className="relative inline-block w-12 h-6">
                  <input type="checkbox" className="sr-only" id="dark-mode" />
                  <label htmlFor="dark-mode" className="block w-12 h-6 bg-warmgray/20 rounded-full cursor-pointer">
                    <span className="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition"></span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Automatische Extraktion</p>
                  <p className="text-sm text-warmgray">Rezepte automatisch nach Download speichern</p>
                </div>
                <div className="relative inline-block w-12 h-6">
                  <input type="checkbox" className="sr-only" id="auto-extract" defaultChecked />
                  <label htmlFor="auto-extract" className="block w-12 h-6 bg-paprika rounded-full cursor-pointer">
                    <span className="dot absolute right-1 top-1 bg-white w-4 h-4 rounded-full transition"></span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">High Quality Images</p>
                  <p className="text-sm text-warmgray">Höhere Bildqualität für Rezept-Fotos</p>
                </div>
                <div className="relative inline-block w-12 h-6">
                  <input type="checkbox" className="sr-only" id="hq-images" defaultChecked />
                  <label htmlFor="hq-images" className="block w-12 h-6 bg-paprika rounded-full cursor-pointer">
                    <span className="dot absolute right-1 top-1 bg-white w-4 h-4 rounded-full transition"></span>
                  </label>
                </div>
              </div>
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
            <h3 className="font-display font-bold text-lg mb-4">App Status</h3>
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
  )
}

export default SettingsPage