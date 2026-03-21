import React, { useState, useEffect } from 'react'
import { Link, Globe, Youtube, Instagram, MessageSquare, AlertCircle } from 'lucide-react'
import { startExtraction, pollJobStatus } from '../api/services.js'

const ExtractionPage: React.FC = () => {
  const [url, setUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<{
    status: string
    progress: number
    currentStage?: string
    message?: string
  } | null>(null)

  useEffect(() => {
    // Poll job status if we have a jobId
    if (jobId && jobStatus?.status !== 'completed' && jobStatus?.status !== 'failed') {
      const interval = setInterval(async () => {
        try {
          const status = await pollJobStatus(jobId)
          setJobStatus({
            status: status.status,
            progress: status.progress,
            currentStage: status.stage,
            message: status.message
          })
          
          if (status.status === 'completed') {
            setSuccess(true)
            setJobId(null)
            clearInterval(interval)
          } else if (status.status === 'failed') {
            setError(status.error || 'Extraction failed')
            setJobId(null)
            clearInterval(interval)
          }
        } catch (err) {
          console.error('Error polling job status:', err)
        }
      }, 1000)
      
      return () => clearInterval(interval)
    }
  }, [jobId, jobStatus])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return

    setIsLoading(true)
    setError(null)
    setSuccess(false)
    setJobStatus(null)

    try {
      // Get user's API key from localStorage
      const userKey = localStorage.getItem('rezepti_groq_key')
      
      // Start extraction job
      const newJobId = await startExtraction(url, userKey || undefined)
      setJobId(newJobId)
      
      // Set initial job status
      setJobStatus({
        status: 'pending',
        progress: 0,
        message: 'Job started...'
      })
      
    } catch (err: any) {
      console.error('Extraction error:', err)
      setError(err.message || 'Fehler beim Extrahieren des Rezepts. Bitte versuche es erneut.')
      setIsLoading(false)
    }
  }

  const exampleUrls = [
    {
      platform: 'YouTube',
      icon: <Youtube size={20} />,
      color: 'bg-red-100 text-red-700',
      examples: [
        'https://www.youtube.com/watch?v=...',
        'https://youtu.be/...',
      ],
    },
    {
      platform: 'Instagram',
      icon: <Instagram size={20} />,
      color: 'bg-pink-100 text-pink-700',
      examples: [
        'https://www.instagram.com/reel/...',
        'https://www.instagram.com/p/...',
      ],
    },
    {
      platform: 'TikTok',
      icon: <MessageSquare size={20} />,
      color: 'bg-black text-white',
      examples: [
        'https://www.tiktok.com/@.../video/...',
        'https://vm.tiktok.com/...',
      ],
    },
    {
      platform: 'Webseite',
      icon: <Globe size={20} />,
      color: 'bg-blue-100 text-blue-700',
      examples: [
        'https://chefkoch.de/rezepte/...',
        'https://www.essen-und-trinken.de/rezept/...',
      ],
    },
  ]

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold mb-2">Rezept extrahieren</h1>
        <p className="text-warmgray">
          Füge eine URL von YouTube, Instagram, TikTok oder einer Rezept-Webseite ein
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main extraction form */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-lg border border-warmgray/10 p-6">
            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <label htmlFor="url" className="block text-sm font-medium text-warmgray mb-2">
                  URL eingeben
                </label>
                <div className="flex space-x-2">
                  <input
                    type="url"
                    id="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="flex-1 px-4 py-3 border border-warmgray/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-paprika focus:border-transparent"
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !url.trim() || !!jobId}
                    className="bg-paprika text-white px-6 py-3 rounded-lg font-medium hover:bg-paprika-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading || jobId ? 'Wird extrahiert...' : 'Extrahiere'}
                  </button>
                </div>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                  <p className="text-red-700">{error}</p>
                </div>
              )}

              {success && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-700 font-medium">Rezept erfolgreich extrahiert!</p>
                  <p className="text-green-600 text-sm mt-1">
                    Das Rezept wurde in deiner Sammlung gespeichert.
                  </p>
                  <Link to="/" className="inline-block mt-3 text-paprika hover:text-paprika-dark font-medium">
                    Zu den Rezepten →
                  </Link>
                </div>
              )}

              {/* Progress simulation */}
               {(isLoading || jobStatus) && (
                <div className="mb-6">
                  <div className="h-2 bg-warmgray/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-paprika transition-all duration-300 ease-out"
                      style={{ width: `${jobStatus?.progress || 0}%` }}
                    ></div>
                  </div>
                  <div className="mt-2 text-sm text-warmgray">
                    <div className="flex justify-between">
                      <span>
                        {jobStatus?.currentStage 
                          ? `${jobStatus.currentStage}...` 
                          : 'URL wird analysiert...'
                        }
                      </span>
                      <span>{jobStatus?.progress || 0}%</span>
                    </div>
                    {jobStatus?.message && (
                      <div className="mt-1 text-xs text-warmgray/70">
                        {jobStatus.message}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </form>

            <div className="border-t border-warmgray/10 pt-6">
              <h3 className="font-display font-bold text-lg mb-4">Unterstützte Plattformen</h3>
              <div className="space-y-4">
                {exampleUrls.map((platform) => (
                  <div key={platform.platform} className="p-4 border border-warmgray/10 rounded-lg">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className={`p-2 rounded-lg ${platform.color}`}>
                        {platform.icon}
                      </div>
                      <span className="font-medium">{platform.platform}</span>
                    </div>
                    <div className="space-y-1">
                      {platform.examples.map((example, idx) => (
                        <div key={idx} className="text-sm text-warmgray font-mono bg-warmgray/5 p-2 rounded">
                          {example}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* BYOK Info */}
          <div className="bg-saffron/10 border border-saffron/20 rounded-2xl p-6">
            <h3 className="font-display font-bold text-lg mb-3">BYOK Support</h3>
            <p className="text-warmgray text-sm mb-4">
              Nutze deinen eigenen Groq API Key, um Rate Limits zu vermeiden.
            </p>
            <Link 
              to="/settings" 
              className="inline-block w-full bg-saffron text-espresso py-2 px-4 rounded-lg font-medium text-center hover:bg-saffron-light transition-colors"
            >
              Key verwalten
            </Link>
          </div>

          {/* Tips */}
          <div className="bg-white border border-warmgray/10 rounded-2xl p-6">
            <h3 className="font-display font-bold text-lg mb-3">Tipps für beste Ergebnisse</h3>
            <ul className="space-y-2 text-sm text-warmgray">
              <li className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-paprika rounded-full mt-1.5"></div>
                <span>YouTube-Videos mit deutschen Untertiteln funktionieren am besten</span>
              </li>
              <li className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-paprika rounded-full mt-1.5"></div>
                <span>Rezept-Webseiten mit Schema.org Markup werden schneller extrahiert</span>
              </li>
              <li className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-paprika rounded-full mt-1.5"></div>
                <span>Instagram/TikTok Videos sollten Rezepte im Video zeigen</span>
              </li>
            </ul>
          </div>

          {/* Status */}
          <div className="bg-white border border-warmgray/10 rounded-2xl p-6">
            <h3 className="font-display font-bold text-lg mb-3">Extraction Status</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-warmgray">Verfügbare Plattformen</span>
                <span className="font-medium">4/4</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-warmgray">API Verfügbarkeit</span>
                <span className="font-medium text-green-600">Online</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-warmgray">Letzte Extraktion</span>
                <span className="font-medium">–</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ExtractionPage