import React, { useState, useRef, useEffect, useCallback } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useCameraPermissions } from 'expo-camera'
import jsQR from 'jsqr'

interface ScannerCameraProps {
  onScan: (value: string) => void
  onClose: () => void
}

const BARCODE_DETECTOR_AVAILABLE = typeof window !== 'undefined' && 'BarcodeDetector' in window

export default function ScannerCamera({ onScan, onClose }: ScannerCameraProps) {
  const [permission, requestPermission] = useCameraPermissions()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const streamRef = useRef<MediaStream | null>(null)
  const scannedRef = useRef(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  const stopStream = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    if (!permission?.granted) return

    let mounted = true

    async function startCamera() {
      try {
        // Request continuous autofocus directly in getUserMedia where supported.
        // Chrome Android accepts focusMode as a video constraint; browsers that
        // don't support it simply ignore the unknown key.
        const videoConstraints: MediaTrackConstraints & { focusMode?: string } = {
          facingMode: { ideal: 'environment' },
          focusMode: 'continuous',
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints })

        streamRef.current = stream
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return }

        if (videoRef.current) {
          const video = videoRef.current
          video.srcObject = stream

          // Apply autofocus AFTER the video starts playing — capabilities may not be
          // populated before the track is fully active on some Android devices
          video.onloadeddata = async () => {
            if (!mounted) return
            const track = stream.getVideoTracks()[0]
            if (!track) return

            // Try as a direct constraint (not in `advanced`, which browsers may silently ignore)
            await (track.applyConstraints as (c: object) => Promise<void>)(
              { focusMode: 'continuous' }
            ).catch(() => {
              // Fallback: try via advanced array
              track.applyConstraints({
                advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet],
              }).catch(() => {})
            })
          }

          video.play()
        }

        if (BARCODE_DETECTOR_AVAILABLE) {
          scanWithBarcodeDetector()
        } else {
          requestAnimationFrame(scanWithJsQR)
        }
      } catch (err) {
        if (mounted) setCameraError('Kamera konnte nicht geöffnet werden.')
        console.error('Camera error:', err)
      }
    }

    async function scanWithBarcodeDetector() {
      if (!mounted) return
      const video = videoRef.current
      if (!video || video.readyState < video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(scanWithBarcodeDetector)
        return
      }
      try {
        // @ts-expect-error BarcodeDetector not in TS lib
        const detector = new BarcodeDetector({ formats: ['qr_code'] })
        const codes: Array<{ rawValue: string }> = await detector.detect(video)
        if (codes.length > 0 && !scannedRef.current) {
          scannedRef.current = true
          setTimeout(() => { scannedRef.current = false }, 500)
          onScan(codes[0].rawValue)
          return
        }
      } catch { /* detector not ready yet, try next frame */ }
      rafRef.current = requestAnimationFrame(scanWithBarcodeDetector)
    }

    function scanWithJsQR() {
      if (!mounted) return
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(scanWithJsQR)
        return
      }
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) { rafRef.current = requestAnimationFrame(scanWithJsQR); return }

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
      rafRef.current = requestAnimationFrame(scanWithJsQR)
    }

    startCamera()
    return () => { mounted = false; stopStream() }
  }, [permission?.granted, onScan, stopStream])

  function handleClose() {
    stopStream()
    onClose()
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

  if (cameraError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>{cameraError}</Text>
        <Pressable style={[styles.button, styles.buttonSecondary]} onPress={handleClose}>
          <Text style={styles.buttonTextSecondary}>Schließen</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <video
        ref={videoRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        playsInline
        muted
      />
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
