import React, { useState, useRef, useEffect, useCallback } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import type { BarcodeScanningResult } from 'expo-camera'
import jsQR from 'jsqr'

interface ScannerCameraProps {
  onScan: (value: string) => void
  onClose: () => void
}

// BarcodeDetector is available in Chrome/Edge but not Firefox/Safari
const BARCODE_DETECTOR_AVAILABLE = typeof window !== 'undefined' && 'BarcodeDetector' in window

export default function ScannerCamera({ onScan, onClose }: ScannerCameraProps) {
  const [permission, requestPermission] = useCameraPermissions()
  const [scanned, setScanned] = useState(false)

  // jsQR fallback refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const streamRef = useRef<MediaStream | null>(null)
  const scannedRef = useRef(false)

  const stopStream = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  // jsQR scan loop — runs only when BarcodeDetector is NOT available
  useEffect(() => {
    if (BARCODE_DETECTOR_AVAILABLE) return
    if (!permission?.granted) return

    let mounted = true

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
        tick()
      } catch {
        // camera access denied or not available
      }
    }

    function tick() {
      if (!mounted) return
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      })

      if (code && !scannedRef.current) {
        scannedRef.current = true
        setTimeout(() => { scannedRef.current = false }, 500)
        onScan(code.data)
        return
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    startCamera()

    return () => {
      mounted = false
      stopStream()
    }
  }, [permission?.granted, onScan, stopStream])

  // Cleanup stream on close
  function handleClose() {
    stopStream()
    onClose()
  }

  function handleBarcodeScan(result: BarcodeScanningResult) {
    if (scanned) return
    setScanned(true)
    setTimeout(() => setScanned(false), 500)
    onScan(result.data)
  }

  if (!permission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>Kamera wird initialisiert…</Text>
      </View>
    )
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>Kamera-Zugriff wird benötigt</Text>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Berechtigung erteilen</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.buttonSecondary]} onPress={handleClose}>
          <Text style={styles.buttonTextSecondary}>Abbrechen</Text>
        </Pressable>
      </View>
    )
  }

  // Firefox/Safari: jsQR canvas-based scanner
  if (!BARCODE_DETECTOR_AVAILABLE) {
    return (
      <View style={StyleSheet.absoluteFillObject}>
        {/* Native video element for camera stream */}
        <video
          ref={videoRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          playsInline
          muted
        />
        {/* Hidden canvas for pixel analysis */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        <Pressable style={styles.closeButton} onPress={handleClose}>
          <Text style={styles.closeButtonText}>✕</Text>
        </Pressable>

        <View style={styles.hintContainer}>
          <Text style={styles.hintText}>QR-Code in den Rahmen halten…</Text>
        </View>

        <View style={styles.frameContainer} pointerEvents="none">
          <View style={styles.frame} />
        </View>
      </View>
    )
  }

  // Chrome/Edge: native BarcodeDetector via Expo CameraView
  return (
    <View style={StyleSheet.absoluteFillObject}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScan}
      />

      <Pressable style={styles.closeButton} onPress={handleClose}>
        <Text style={styles.closeButtonText}>✕</Text>
      </Pressable>

      <View style={styles.hintContainer}>
        <Text style={styles.hintText}>QR-Code in den Rahmen halten…</Text>
      </View>

      <View style={styles.frameContainer} pointerEvents="none">
        <View style={styles.frame} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    gap: 16,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  button: {
    backgroundColor: '#C84B31',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  buttonTextSecondary: {
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
    fontSize: 16,
  },
  closeButton: {
    position: 'absolute',
    top: 56,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#111',
    fontWeight: '600',
  },
  hintContainer: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintText: {
    color: '#fff',
    fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  frameContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: 'rgba(200,75,49,0.8)',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
})
