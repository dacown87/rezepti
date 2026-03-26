import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Play, Camera, Globe, ChevronDown, ChevronUp, Copy, Check, ImagePlus, X } from 'lucide-react'
import { startExtraction, startPhotoExtraction, pollJobStatus } from '../api/services.js'
import { useToast } from './ToastManager'

type Mode = 'url' | 'photo'

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
  const [mode, setMode] = useState<Mode>('url')
  const [url, setUrl] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
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
  const handledRef = useRef(false)
  const urlRef = useRef(url)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { urlRef.current = url }, [url])

  useEffect(() => {
    if (!jobId) return
    handledRef.current = false

    const interval = setInterval(async () => {
      if (handledRef.current) return
      try {
        const status = await pollJobStatus(jobId)
        const p = status.progress ?? STAGES[status.stage ?? ''] ?? 0
        setProgress(p)
        if (status.stage) setStage(status.stage)

        if (status.status === 'completed') {
          handledRef.current = true
          setSuccess(true)
          setProgress(100)
          setStage('done')
          setIsLoading(false)
          setJobId(null)
          addToast('Rezept erfolgreich extrahiert!', 'success')
          clearInterval(interval)
        } else if (status.status === 'failed') {
          handledRef.current = true
          const msg = status.error || 'Extraktion fehlgeschlagen'
          setError(msg)
          setErrorDetails({ url: urlRef.current, jobId, time: new Date().toLocaleString('de-DE') })
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

  const handlePhotoChange = (file: File | null) => {
    setPhotoFile(file)
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => setPhotoPreview(e.target?.result as string)
      reader.readAsDataURL(file)
    } else {
      setPhotoPreview(null)
    }
  }

  const handlePhotoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!photoFile) return

    setIsLoading(true)
    setError(null)
    setSuccess(false)
    setProgress(10)
    setStage('analyzing_image')

    try {
      const newJobId = await startPhotoExtraction(photoFile)
      setJobId(newJobId)
    } catch (err: any) {
      const msg = err.message || 'Fehler beim Hochladen des Fotos'
      setError(msg)
      setErrorDetails({ url: photoFile.name, jobId: null, time: new Date().toLocaleString('de-DE') })
      addToast(msg, 'error')
      setIsLoading(false)
      setProgress(0)
      setStage(null)
    }
  }

  const reset = () => {
    setUrl('')
    setPhotoFile(null)
    setPhotoPreview(null)
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
          {mode === 'url' ? (
            <>Rezepte,{' '}<span className="italic text-paprika">ein Link entfernt.</span></>
          ) : (
            <>Rezept{' '}<span className="italic text-paprika">fotografieren.</span></>
          )}
        </h1>

        {/* Subtitle */}
        <p className="animate-hero-rise delay-300 font-body text-warmgray text-lg max-w-md mx-auto mb-8 leading-relaxed">
          {mode === 'url'
            ? 'Füge eine URL ein — RecipeDeck extrahiert das Rezept automatisch und übersetzt es ins Deutsche.'
            : 'Foto eines Rezepts hochladen — die KI erkennt Zutaten und Schritte automatisch.'}
        </p>

        {/* Mode toggle */}
        <div className="animate-hero-rise delay-350 flex items-center justify-center mb-8">
          <div className="flex bg-white/70 backdrop-blur-sm border border-espresso/[0.08] rounded-2xl p-1 gap-1">
            <button
              onClick={() => { setMode('url'); reset() }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                mode === 'url' ? 'bg-paprika text-white shadow-sm' : 'text-warmgray hover:text-espresso'
              }`}
            >
              <Globe size={15} />
              URL
            </button>
            <button
              onClick={() => { setMode('photo'); reset() }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                mode === 'photo' ? 'bg-paprika text-white shadow-sm' : 'text-warmgray hover:text-espresso'
              }`}
            >
              <Camera size={15} />
              Foto
            </button>
          </div>
        </div>

        {/* Form */}
        {!success ? (
          <form
            onSubmit={mode === 'url' ? handleSubmit : handlePhotoSubmit}
            className="animate-hero-rise delay-400 mb-8"
          >
            {/* URL input */}
            {mode === 'url' && (
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
            )}

            {/* Photo input */}
            {mode === 'photo' && (
              <div className="max-w-lg mx-auto">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)}
                />
                {!photoFile ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className="w-full py-12 rounded-2xl border-2 border-dashed border-espresso/15 bg-white/60 backdrop-blur-sm hover:bg-white/80 hover:border-paprika/30 transition-all duration-300 flex flex-col items-center gap-3 text-warmgray disabled:opacity-50"
                  >
                    <ImagePlus size={36} className="text-warmgray/40" />
                    <div>
                      <p className="font-medium text-espresso/70">Foto auswählen oder aufnehmen</p>
                      <p className="text-xs mt-1 text-warmgray/60">JPEG, PNG oder WebP · max. 10 MB</p>
                    </div>
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="relative rounded-2xl overflow-hidden border border-espresso/10 bg-white/60">
                      <img src={photoPreview!} alt="Vorschau" className="w-full max-h-64 object-cover" />
                      <button
                        type="button"
                        onClick={() => handlePhotoChange(null)}
                        className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isLoading}
                        className="flex-1 py-3 rounded-2xl border border-espresso/15 bg-white/60 text-warmgray text-sm font-medium hover:bg-white/80 transition-colors disabled:opacity-50"
                      >
                        Anderes Foto
                      </button>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="flex-1 py-3 rounded-2xl bg-paprika text-white font-semibold hover:bg-paprika-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-md active:scale-[0.97]"
                      >
                        {isLoading ? 'Läuft…' : 'Extrahieren'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}


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
                  <span>
                    {stage ? (STAGE_LABELS[stage] ?? stage) : 'Wird gestartet…'}
                    {(stage === 'transcribing' || stage === 'analyzing_image' || stage === 'extracting') && (
                      <span className="opacity-50"> — bitte warten</span>
                    )}
                  </span>
                  <span className="font-medium text-paprika">{progress}%</span>
                </div>
                <div className="h-2 bg-warmgray/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-paprika to-saffron rounded-full transition-all duration-700 ease-out progress-shimmer"
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
          {(mode === 'url' ? [
            { label: 'YouTube', icon: <Play size={14} /> },
            { label: 'Instagram', icon: <Camera size={14} /> },
            { label: 'TikTok', icon: <span className="text-xs font-bold">T</span> },
            { label: 'Webseiten', icon: <Globe size={14} /> },
          ] : [
            { label: 'Kamera', icon: <Camera size={14} /> },
            { label: 'Galerie', icon: <ImagePlus size={14} /> },
            { label: 'JPEG / PNG / WebP', icon: <Globe size={14} /> },
          ]).map(({ label, icon }) => (
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
