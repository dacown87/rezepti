import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Play, Camera, Globe, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react'
import { startExtraction, pollJobStatus } from '../api/services.js'
import { useToast } from './ToastManager'

const STAGES: Record<string, number> = {
  classifying: 20,
  fetching: 35,
  transcribing: 50,
  analyzing_image: 65,
  extracting: 80,
  exporting: 92,
  done: 100,
}

const STAGE_LABELS: Record<string, string> = {
  classifying: 'URL wird analysiert',
  fetching: 'Inhalte werden abgerufen',
  transcribing: 'Audio wird transkribiert',
  analyzing_image: 'Bild wird analysiert',
  extracting: 'Rezept wird extrahiert',
  exporting: 'Wird gespeichert',
  done: 'Fertig!',
}

const ExtractionPage: React.FC = () => {
  const [url, setUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorDetails, setErrorDetails] = useState<{ url: string; jobId: string | null; time: string } | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [copied, setCopied] = useState(false)
  const [success, setSuccess] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState<string | null>(null)
  const { addToast } = useToast()

  useEffect(() => {
    if (!jobId) return
    if (progress >= 100) return

    const interval = setInterval(async () => {
      try {
        const status = await pollJobStatus(jobId)
        const p = status.progress ?? STAGES[status.stage ?? ''] ?? progress
        setProgress(p)
        if (status.stage) setStage(status.stage)

        if (status.status === 'completed') {
          setSuccess(true)
          setProgress(100)
          setStage('done')
          setIsLoading(false)
          setJobId(null)
          addToast('Rezept erfolgreich extrahiert!', 'success')
          clearInterval(interval)
        } else if (status.status === 'failed') {
          const msg = status.error || 'Extraktion fehlgeschlagen'
          setError(msg)
          setErrorDetails({ url, jobId, time: new Date().toLocaleString('de-DE') })
          setIsLoading(false)
          setJobId(null)
          addToast(msg, 'error')
          clearInterval(interval)
        }
      } catch {
        // keep polling on transient errors
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [jobId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return

    setIsLoading(true)
    setError(null)
    setSuccess(false)
    setProgress(5)
    setStage('classifying')

    try {
      const userKey = localStorage.getItem('rezepti_groq_key')
      const newJobId = await startExtraction(url, userKey || undefined)
      setJobId(newJobId)
    } catch (err: any) {
      const msg = err.message || 'Fehler beim Starten der Extraktion'
      setError(msg)
      setErrorDetails({ url, jobId: null, time: new Date().toLocaleString('de-DE') })
      addToast(msg, 'error')
      setIsLoading(false)
      setProgress(0)
      setStage(null)
    }
  }

  const reset = () => {
    setUrl('')
    setError(null)
    setErrorDetails(null)
    setShowDetails(false)
    setCopied(false)
    setSuccess(false)
    setProgress(0)
    setStage(null)
    setJobId(null)
    setIsLoading(false)
  }

  const copyError = () => {
    if (!error || !errorDetails) return
    const text = [
      `Fehler: ${error}`,
      `URL: ${errorDetails.url}`,
      errorDetails.jobId ? `Job-ID: ${errorDetails.jobId}` : null,
      `Zeit: ${errorDetails.time}`,
    ].filter(Boolean).join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative overflow-hidden -mx-4 -mt-8 px-4 pt-16 pb-20 min-h-[70vh] flex flex-col items-center justify-center grain">
      {/* Decorative blur orbs */}
      <div
        className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 rounded-full blur-3xl"
        style={{ background: 'rgba(236,173,75,0.08)' }}
      />
      <div
        className="pointer-events-none absolute -bottom-16 -left-16 w-64 h-64 rounded-full blur-3xl"
        style={{ background: 'rgba(200,75,49,0.07)' }}
      />
      <div
        className="pointer-events-none absolute top-1/3 left-[6%] w-44 h-44 rounded-full blur-2xl animate-float-gentle"
        style={{ background: 'rgba(236,173,75,0.09)' }}
      />
      <div
        className="pointer-events-none absolute top-[18%] right-[10%] w-32 h-32 rounded-full blur-2xl animate-float-offset"
        style={{ background: 'rgba(200,75,49,0.06)' }}
      />

      <div className="relative z-10 w-full max-w-xl mx-auto text-center">
        {/* Eyebrow */}
        <p className="animate-hero-rise delay-100 font-body text-xs tracking-[0.3em] uppercase text-warmgray/70 mb-5">
          KI-gestützte Rezeptextraktion
        </p>

        {/* Headline */}
        <h1 className="animate-hero-rise delay-200 font-display text-[clamp(2.4rem,6vw,4rem)] font-semibold leading-[1.08] tracking-tight text-espresso mb-5">
          Rezepte,{' '}
          <span className="italic text-paprika">ein Link entfernt.</span>
        </h1>

        {/* Subtitle */}
        <p className="animate-hero-rise delay-300 font-body text-warmgray text-lg max-w-md mx-auto mb-10 leading-relaxed">
          Füge eine URL ein — Rezepti extrahiert das Rezept automatisch und übersetzt es ins Deutsche.
        </p>

        {/* Form */}
        {!success ? (
          <form onSubmit={handleSubmit} className="animate-hero-rise delay-400 mb-8">
            <div className="flex items-center gap-3 max-w-lg mx-auto">
              <div className="relative flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-warmgray/40 pointer-events-none">
                  <Globe size={18} />
                </span>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=…"
                  disabled={isLoading}
                  className="w-full pl-11 pr-4 py-4 rounded-2xl border-2 border-espresso/[0.08] bg-white/80 backdrop-blur-sm text-espresso placeholder-warmgray/40 focus:outline-none focus:border-paprika/40 focus:bg-white text-base font-body transition-all duration-300 disabled:opacity-60"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || !url.trim()}
                className="whitespace-nowrap px-6 py-4 rounded-2xl bg-paprika text-white font-semibold hover:bg-paprika-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-md hover:shadow-lg active:scale-[0.97] transition-transform duration-150"
              >
                {isLoading ? 'Läuft…' : 'Extrahieren'}
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="mt-4 max-w-lg mx-auto bg-red-50 border border-red-200 rounded-xl text-sm text-left overflow-hidden">
                <div className="flex items-start justify-between gap-3 p-3">
                  <span className="text-red-700 flex-1">{error}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setShowDetails(v => !v)}
                      className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors"
                    >
                      Details {showDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                    <button onClick={reset} className="text-xs text-red-400 hover:text-red-600 underline transition-colors">
                      Zurücksetzen
                    </button>
                  </div>
                </div>
                {showDetails && errorDetails && (
                  <div className="border-t border-red-200 bg-red-100/60 p-3">
                    <pre className="text-xs text-red-800 font-mono whitespace-pre-wrap break-all leading-relaxed">
                      {`Fehler: ${error}\nURL:    ${errorDetails.url}${errorDetails.jobId ? `\nJob-ID: ${errorDetails.jobId}` : ''}\nZeit:   ${errorDetails.time}`}
                    </pre>
                    <button
                      onClick={copyError}
                      className="mt-2 flex items-center gap-1.5 text-xs text-red-600 hover:text-red-800 transition-colors"
                    >
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                      {copied ? 'Kopiert!' : 'Kopieren'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Progress */}
            {isLoading && (
              <div className="mt-6 max-w-lg mx-auto">
                <div className="flex justify-between items-center mb-2 text-sm text-warmgray">
                  <span>{stage ? (STAGE_LABELS[stage] ?? stage) : 'Wird gestartet…'}</span>
                  <span className="font-medium text-paprika">{progress}%</span>
                </div>
                <div className="h-2 bg-warmgray/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-paprika to-saffron rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </form>
        ) : (
          <div className="animate-hero-rise delay-100 mb-8 max-w-lg mx-auto p-6 bg-white/80 backdrop-blur-sm rounded-2xl border border-saffron/30 shadow-lg">
            <p className="text-2xl mb-2">🎉</p>
            <h3 className="font-display font-bold text-xl mb-1">Rezept gespeichert!</h3>
            <p className="text-warmgray text-sm mb-4">Das Rezept wurde extrahiert und in deiner Sammlung gespeichert.</p>
            <div className="flex gap-3 justify-center">
              <Link
                to="/"
                className="px-5 py-2.5 bg-paprika text-white rounded-xl font-medium hover:bg-paprika-dark transition-colors text-sm"
              >
                Zur Sammlung
              </Link>
              <button
                onClick={reset}
                className="px-5 py-2.5 border border-warmgray/20 text-warmgray rounded-xl font-medium hover:bg-warmgray/5 transition-colors text-sm"
              >
                Weiteres Rezept
              </button>
            </div>
          </div>
        )}

        {/* Platform badges */}
        <div className="animate-hero-rise delay-500 flex items-center justify-center gap-2 flex-wrap">
          <span className="text-warmgray/50 text-xs mr-1">Unterstützt</span>
          {[
            { label: 'YouTube', icon: <Play size={14} /> },
            { label: 'Instagram', icon: <Camera size={14} /> },
            { label: 'TikTok', icon: <span className="text-xs font-bold">T</span> },
            { label: 'Webseiten', icon: <Globe size={14} /> },
          ].map(({ label, icon }) => (
            <span
              key={label}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/60 backdrop-blur-sm border border-espresso/[0.07] text-xs font-medium text-espresso/70"
            >
              {icon}
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ExtractionPage
