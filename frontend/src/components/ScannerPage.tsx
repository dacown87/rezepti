import React, { useState, useRef, useEffect } from 'react'
import { Camera, X, ChefHat, Save, AlertCircle } from 'lucide-react'
import { isRecipeJSONQR, decodeRecipeFromCompactJSON, parseCompactRecipeToFull } from '../utils/recipe-qr.js'
import { saveRecipe } from '../api/services.js'
import type { Recipe } from '../api/types.js'
import { useToast } from './ToastManager'

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats: string[] }) => {
      detect: (image: ImageBitmapSource) => Promise<{ rawValue: string }[]>
    }
  }
}

const ScannerPage: React.FC = () => {
  const [scanning, setScanning] = useState(false)
  const [scannedRecipe, setScannedRecipe] = useState<Partial<Recipe> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanningRef = useRef(false)
  const { addToast } = useToast()

  const startScanning = async () => {
    setError(null)

    if (!window.BarcodeDetector) {
      setError('QR-Scanner nicht verfügbar. Bitte nutze einen Chromium-Browser (Chrome, Edge).')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        scanningRef.current = true
        setScanning(true)
        requestAnimationFrame(scanFrame)
      }
    } catch (err) {
      console.error('Camera error:', err)
      setError('Kamera konnte nicht geöffnet werden.')
    }
  }

  const scanFrame = async () => {
    if (!videoRef.current || !scanningRef.current) return

    try {
      const detector = new window.BarcodeDetector!({ formats: ['qr_code'] })
      const barcodes = await detector.detect(videoRef.current)

      if (barcodes.length > 0) {
        const value = barcodes[0].rawValue

        if (isRecipeJSONQR(value)) {
          const decoded = decodeRecipeFromCompactJSON(value)
          if (decoded) {
            setScannedRecipe(parseCompactRecipeToFull(decoded))
            stopScanning()
            return
          }
        }
      }
    } catch (err) {
      // Ignore scan errors
    }

    if (scanningRef.current) {
      requestAnimationFrame(scanFrame)
    }
  }

  const stopScanning = () => {
    scanningRef.current = false
    setScanning(false)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }

  const handleImport = async () => {
    if (!scannedRecipe?.name || !scannedRecipe?.ingredients || !scannedRecipe?.steps) {
      addToast('Ungültige Rezeptdaten', 'error')
      return
    }

    setImporting(true)
    try {
      await saveRecipe({
        name: scannedRecipe.name,
        emoji: scannedRecipe.emoji || '🍽️',
        ingredients: scannedRecipe.ingredients,
        steps: scannedRecipe.steps,
        servings: scannedRecipe.servings || '',
        duration: scannedRecipe.duration || '',
        tags: scannedRecipe.tags || [],
        imageUrl: scannedRecipe.imageUrl,
      }, 'qr://import')
      
      addToast('Rezept importiert!', 'success')
      setScannedRecipe(null)
    } catch (err) {
      console.error('Import failed:', err)
      addToast('Import fehlgeschlagen', 'error')
    } finally {
      setImporting(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)

    try {
      const img = new Image()
      img.src = URL.createObjectURL(file)
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Bild konnte nicht geladen werden'))
      })

      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas not supported')
      ctx.drawImage(img, 0, 0)

      if (window.BarcodeDetector) {
        const detector = new window.BarcodeDetector!({ formats: ['qr_code'] })
        const barcodes = await detector.detect(canvas)
        
        if (barcodes.length > 0) {
          const value = barcodes[0].rawValue
          if (isRecipeJSONQR(value)) {
            const decoded = decodeRecipeFromCompactJSON(value)
            if (decoded) {
              setScannedRecipe(parseCompactRecipeToFull(decoded))
              URL.revokeObjectURL(img.src)
              return
            }
          }
        }
        setError('Kein gültiger Rezept-QR-Code gefunden')
      } else {
        setError('QR-Scanner für Bilder nicht verfügbar. Bitte nutze die Kamera oder einen Chromium-Browser (Chrome, Edge).')
      }
    } catch (err) {
      console.error('File upload error:', err)
      setError('Fehler beim Lesen der Datei')
    } finally {
      e.target.value = ''
    }
  }

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold flex items-center gap-3">
          <Camera className="h-8 w-8 text-paprika" />
          QR-Code scannen
        </h1>
        <p className="text-warmgray mt-1">Rezept aus einem QR-Code importieren</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
          <AlertCircle className="text-red-500 flex-shrink-0" />
          <span className="text-red-700">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
            <X size={18} />
          </button>
        </div>
      )}

      {scannedRecipe ? (
        <div className="bg-white rounded-2xl shadow-lg border border-warmgray/10 p-6">
          <div className="flex items-center gap-2 mb-4">
            <ChefHat className="text-saffron" />
            <span className="font-medium">Gefundenes Rezept:</span>
          </div>
          
          <div className="text-2xl font-bold mb-2">
            {scannedRecipe.emoji} {scannedRecipe.name}
          </div>
          
          <div className="text-sm text-warmgray mb-4">
            {scannedRecipe.ingredients?.length} Zutaten • {scannedRecipe.steps?.length} Schritte
            {scannedRecipe.rating && ` • ${'★'.repeat(scannedRecipe.rating)}`}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleImport}
              disabled={importing}
              className="flex-1 bg-paprika text-white py-3 px-6 rounded-lg font-medium hover:bg-paprika-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {importing ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
              ) : (
                <Save size={20} />
              )}
              Importieren
            </button>
            <button
              onClick={() => setScannedRecipe(null)}
              className="px-6 py-3 border border-warmgray/20 rounded-lg hover:bg-warmgray/5 transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Camera preview */}
          {scanning ? (
            <div className="relative rounded-2xl overflow-hidden bg-black">
              <video
                ref={videoRef}
                className="w-full aspect-square object-cover"
                playsInline
                muted
              />
              <button
                onClick={stopScanning}
                className="absolute top-4 right-4 p-2 bg-white/90 rounded-full"
              >
                <X size={20} />
              </button>
              <div className="absolute bottom-4 left-0 right-0 text-center text-white text-sm bg-black/50 py-2">
                QR-Code in den Rahmen halten...
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={startScanning}
                className="w-full bg-paprika text-white py-4 px-6 rounded-xl font-medium hover:bg-paprika-dark transition-colors flex items-center justify-center gap-3"
              >
                <Camera size={24} />
                Kamera öffnen
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-warmgray/20"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-cream text-warmgray">oder</span>
                </div>
              </div>

              <label className="block w-full p-4 border-2 border-dashed border-warmgray/30 rounded-xl text-center cursor-pointer hover:border-paprika hover:bg-paprika/5 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <span className="text-warmgray">
                  Bildschirmfoto eines QR-Codes hochladen
                </span>
              </label>
              {!window.BarcodeDetector && (
                <p className="text-xs text-saffron-dark mt-2 text-center">
                  Für Bild-Upload wird Chrome, Edge oder Chromium-Browser empfohlen
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default ScannerPage