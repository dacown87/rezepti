import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Play, Camera, Globe, ChevronDown, ChevronUp, Copy, Check, ImagePlus, X, ScanLine } from 'lucide-react'
import { startExtraction, startPhotoExtraction, pollJobStatus, saveRecipe } from '../api/services.js'
import { isRecipeJSONQR, decodeRecipeFromCompactJSON, parseCompactRecipeToFull } from '../utils/recipe-qr.js'
import type { Recipe } from '../api/types.js'
import { useToast } from './ToastManager'

type Mode = 'url' | 'camera' | 'file' | 'qr'

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

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats: string[] }) => {
      detect: (image: ImageBitmapSource) => Promise<{ rawValue: string }[]>
    }
  }
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
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const qrVideoRef = useRef<HTMLVideoElement>(null)
  const qrStreamRef = useRef<MediaStream | null>(null)
  const qrScanningRef = useRef(false)
  const [qrScanning, setQrScanning] = useState(false)
  const [qrError, setQrError] = useState<string | null>(null)
  const [qrScannedRecipe, setQrScannedRecipe] = useState<Partial<Recipe> | null>(null)
  const [qrImporting, setQrImporting] = useState(false)

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

  useEffect(() => {
    return () => {
      if (qrStreamRef.current) {
        qrStreamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

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

  const stopQrScanning = () => {
    qrScanningRef.current = false
    setQrScanning(false)
    if (qrStreamRef.current) {
      qrStreamRef.current.getTracks().forEach(track => track.stop())
      qrStreamRef.current = null
    }
  }

  const startQrScanning = async () => {
    setQrError(null)

    if (!window.BarcodeDetector) {
      setQrError('QR-Scanner nicht verfügbar. Bitte nutze einen Chromium-Browser (Chrome, Edge).')
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setQrError('Kamera nicht verfügbar. Bitte HTTPS nutzen und Kamera-Berechtigung erteilen.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      })
      qrStreamRef.current = stream

      if (qrVideoRef.current) {
        qrVideoRef.current.srcObject = stream
        await qrVideoRef.current.play()
        qrScanningRef.current = true
        setQrScanning(true)
        requestAnimationFrame(scanQrFrame)
      }
    } catch (err: any) {
      console.error('Camera error:', err)
      if (err.name === 'NotAllowedError') {
        setQrError('Kamera-Zugriff verweigert. Bitte Berechtigung erteilen.')
      } else if (err.name === 'NotFoundError') {
        setQrError('Keine Kamera gefunden.')
      } else if (err.name === 'NotReadableError') {
        setQrError('Kamera wird bereits von einer anderen App verwendet.')
      } else {
        setQrError('Kamera konnte nicht geöffnet werden.')
      }
    }
  }

  const scanQrFrame = async () => {
    if (!qrVideoRef.current || !qrScanningRef.current) return

    try {
      const detector = new window.BarcodeDetector!({ formats: ['qr_code'] })
      const barcodes = await detector.detect(qrVideoRef.current)

      if (barcodes.length > 0) {
        const value = barcodes[0].rawValue

        if (isRecipeJSONQR(value)) {
          const decoded = decodeRecipeFromCompactJSON(value)
          if (decoded) {
            setQrScannedRecipe(parseCompactRecipeToFull(decoded))
            stopQrScanning()
            return
          }
        }
      }
    } catch (err) {
      // Ignore scan errors
    }

    if (qrScanningRef.current) {
      requestAnimationFrame(scanQrFrame)
    }
  }

  const handleQrImport = async () => {
    if (!qrScannedRecipe?.name || !qrScannedRecipe?.ingredients || !qrScannedRecipe?.steps) {
      addToast('Ungültige Rezeptdaten', 'error')
      return
    }

    setQrImporting(true)
    try {
      await saveRecipe({
        name: qrScannedRecipe.name,
        emoji: qrScannedRecipe.emoji || '🍽️',
        ingredients: qrScannedRecipe.ingredients,
        steps: qrScannedRecipe.steps,
        servings: qrScannedRecipe.servings || '',
        duration: qrScannedRecipe.duration || '',
        tags: qrScannedRecipe.tags || [],
        imageUrl: qrScannedRecipe.imageUrl,
      }, 'qr://import')

      addToast('Rezept importiert!', 'success')
      setQrScannedRecipe(null)
      setSuccess(true)
    } catch (err) {
      console.error('Import failed:', err)
      addToast('Import fehlgeschlagen', 'error')
    } finally {
      setQrImporting(false)
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
    setQrScannedRecipe(null)
    setQrError(null)
    stopQrScanning()
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

  const headline = () => {
    if (mode === 'url') return <>Rezepte,{' '}<span className="italic text-paprika">ein Link entfernt.</span></>
    if (mode === 'qr') return <>Rezept{' '}<span className="italic text-paprika">per QR scannen.</span></>
    return <>Rezept{' '}<span className="italic text-paprika">fotografieren.</span></>
  }

  const subtitle = () => {
    if (mode === 'url') return 'Füge eine URL ein — RecipeDeck extrahiert das Rezept automatisch und übersetzt es ins Deutsche.'
    if (mode === 'qr') return 'QR-Code eines gespeicherten Rezepts scannen — die KI-extrahierten Daten werden direkt importiert.'
    return 'Foto eines Rezepts hochladen — die KI erkennt Zutaten und Schritte automatisch.'
  }

  const platformBadges = () => {
    if (mode === 'url') return [
      { label: 'YouTube', icon: <Play size={14} /> },
      { label: 'Instagram', icon: <Camera size={14} /> },
      { label: 'TikTok', icon: <span className="text-xs font-bold">T</span> },
      { label: 'Webseiten', icon: <Globe size={14} /> },
    ]
    if (mode === 'qr') return [
      { label: 'QR-Code', icon: <ScanLine size={14} /> },
      { label: 'Offline', icon: <Globe size={14} /> },
      { label: 'Import', icon: <ImagePlus size={14} /> },
    ]
    return [
      { label: 'Kamera', icon: <Camera size={14} /> },
      { label: 'Galerie', icon: <ImagePlus size={14} /> },
      { label: 'JPEG / PNG / WebP', icon: <Globe size={14} /> },
    ]
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
          {headline()}
        </h1>

        {/* Subtitle */}
        <p className="animate-hero-rise delay-300 font-body text-warmgray text-lg max-w-md mx-auto mb-8 leading-relaxed">
          {subtitle()}
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
              onClick={() => { setMode('camera'); reset() }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                mode === 'camera' || mode === 'file' ? 'bg-paprika text-white shadow-sm' : 'text-warmgray hover:text-espresso'
              }`}
            >
              <Camera size={15} />
              Foto
            </button>
            <button
              onClick={() => { setMode('qr'); reset() }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                mode === 'qr' ? 'bg-paprika text-white shadow-sm' : 'text-warmgray hover:text-espresso'
              }`}
            >
              <ScanLine size={15} />
              QR
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

            {/* Photo input (camera or file) */}
            {(mode === 'camera' || mode === 'file') && (
              <div className="max-w-lg mx-auto">
                <div className="hidden">
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)}
                  />
                </div>
                {!photoFile ? (
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={isLoading}
                      className="flex-1 py-12 rounded-2xl border-2 border-dashed border-espresso/15 bg-white/60 backdrop-blur-sm hover:bg-white/80 hover:border-paprika/30 transition-all duration-300 flex flex-col items-center gap-3 text-warmgray disabled:opacity-50"
                    >
                      <Camera size={36} className="text-warmgray/40" />
                      <div>
                        <p className="font-medium text-espresso/70">Kamera</p>
                        <p className="text-xs mt-1 text-warmgray/60">Rezept fotografieren</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLoading}
                      className="flex-1 py-12 rounded-2xl border-2 border-dashed border-espresso/15 bg-white/60 backdrop-blur-sm hover:bg-white/80 hover:border-paprika/30 transition-all duration-300 flex flex-col items-center gap-3 text-warmgray disabled:opacity-50"
                    >
                      <ImagePlus size={36} className="text-warmgray/40" />
                      <div>
                        <p className="font-medium text-espresso/70">Datei</p>
                        <p className="text-xs mt-1 text-warmgray/60">Bild auswählen</p>
                      </div>
                    </button>
                  </div>
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
                        onClick={() => (mode === 'camera' ? cameraInputRef.current?.click() : fileInputRef.current?.click())}
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

            {/* QR scan mode */}
            {mode === 'qr' && (
              <div className="max-w-lg mx-auto">
                {qrError && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                    <span className="text-red-700 flex-1">{qrError}</span>
                    <button onClick={() => setQrError(null)} className="text-red-500 hover:text-red-700">
                      <X size={16} />
                    </button>
                  </div>
                )}

                {qrScannedRecipe ? (
                  <div className="bg-white rounded-2xl shadow-lg border border-saffron/30 p-6">
                    <p className="text-2xl mb-2">🎉</p>
                    <h3 className="font-display font-bold text-xl mb-1">{qrScannedRecipe.emoji} {qrScannedRecipe.name}</h3>
                    <p className="text-warmgray text-sm mb-4">
                      {qrScannedRecipe.ingredients?.length} Zutaten • {qrScannedRecipe.steps?.length} Schritte
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={handleQrImport}
                        disabled={qrImporting}
                        className="flex-1 py-3 rounded-2xl bg-paprika text-white font-semibold hover:bg-paprika-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-md active:scale-[0.97]"
                      >
                        {qrImporting ? 'Wird importiert…' : 'Importieren'}
                      </button>
                      <button
                        onClick={() => setQrScannedRecipe(null)}
                        className="py-3 px-6 border border-warmgray/20 rounded-2xl text-warmgray hover:bg-warmgray/5 transition-colors"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={`relative rounded-2xl overflow-hidden bg-black ${qrScanning ? '' : 'hidden'}`}>
                      <video
                        ref={qrVideoRef}
                        className="w-full aspect-square object-cover"
                        playsInline
                        muted
                      />
                      <button
                        onClick={stopQrScanning}
                        className="absolute top-4 right-4 p-2 bg-white/90 rounded-full hover:bg-white"
                      >
                        <X size={20} />
                      </button>
                      <div className="absolute bottom-4 left-0 right-0 text-center text-white text-sm bg-black/50 py-2">
                        QR-Code in den Rahmen halten…
                      </div>
                    </div>
                    {!qrScanning && (
                      <div className="py-12 rounded-2xl border-2 border-dashed border-espresso/15 bg-white/60 backdrop-blur-sm flex flex-col items-center gap-3 text-warmgray">
                        <ScanLine size={48} className="text-warmgray/40" />
                        <div>
                          <p className="font-medium text-espresso/70">QR-Code scannen</p>
                          <p className="text-xs mt-1 text-warmgray/60">Rezept-QR-Code mit der Kamera erfassen</p>
                        </div>
                        <button
                          type="button"
                          onClick={startQrScanning}
                          disabled={!window.BarcodeDetector}
                          className="mt-2 px-6 py-2.5 rounded-xl bg-paprika text-white font-medium hover:bg-paprika-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
                        >
                          Kamera starten
                        </button>
                        {!window.BarcodeDetector && (
                          <p className="text-xs text-saffron-dark mt-2">
                            QR-Scanner benötigt Chrome, Edge oder Chromium
                          </p>
                        )}
                      </div>
                    )}
                  </>
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
          {platformBadges().map(({ label, icon }) => (
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
