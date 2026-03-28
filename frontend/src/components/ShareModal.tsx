import React, { useEffect, useState } from 'react'
import { X, Copy, Check, QrCode } from 'lucide-react'
import QRCode from 'qrcode'
import { encodeRecipeToCompactJSON } from '../utils/recipe-qr.js'
import type { Recipe } from '../api/types.js'

interface ShareModalProps {
  recipe: Recipe
  onClose: () => void
}

const ShareModal: React.FC<ShareModalProps> = ({ recipe, onClose }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const generateQR = async () => {
      const encoded = encodeRecipeToCompactJSON(recipe)
      if (!encoded) {
        setError('Rezept ist zu groß für QR-Code')
        return
      }

      try {
        const url = await QRCode.toDataURL(encoded, {
          width: 280,
          margin: 2,
          color: {
            dark: '#4A3728',
            light: '#FFFFFF',
          },
        })
        setQrDataUrl(url)
      } catch (err) {
        console.error('QR generation failed:', err)
        setError('QR-Code konnte nicht erstellt werden')
      }
    }

    generateQR()
  }, [recipe])

  const handleCopy = async () => {
    const encoded = encodeRecipeToCompactJSON(recipe)
    if (!encoded) return

    try {
      await navigator.clipboard.writeText(encoded)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch {
      setError('Kopieren fehlgeschlagen')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6" 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <QrCode className="text-paprika" size={24} />
            <h3 className="text-lg font-display font-bold">Rezept teilen</h3>
          </div>
          <button
            onClick={onClose}
            className="text-warmgray/50 hover:text-warmgray transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-warmgray mb-4">
          Scanne den QR-Code mit deinem Handy, um dieses Rezept offline verfügbar zu machen.
        </p>

        {error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg text-center text-sm">
            {error}
          </div>
        ) : qrDataUrl ? (
          <div className="flex flex-col items-center">
            <div className="bg-white p-4 rounded-xl border border-warmgray/10 shadow-sm mb-4">
              <img src={qrDataUrl} alt="QR-Code" className="w-64 h-64" />
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center space-x-2 text-paprika hover:text-paprika-dark transition-colors text-sm font-medium"
            >
              {copySuccess ? <Check size={16} /> : <Copy size={16} />}
              <span>{copySuccess ? 'Kopiert!' : 'Als Text kopieren'}</span>
            </button>
          </div>
        ) : (
          <div className="flex justify-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-paprika border-t-transparent rounded-full" />
          </div>
        )}
      </div>
    </div>
  )
}

export default ShareModal
