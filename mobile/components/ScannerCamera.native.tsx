import React, { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import type { BarcodeScanningResult } from 'expo-camera'

interface ScannerCameraProps {
  onScan: (value: string) => void
  onClose: () => void
}

export default function ScannerCamera({ onScan, onClose }: ScannerCameraProps) {
  const [permission, requestPermission] = useCameraPermissions()
  const [scanned, setScanned] = useState(false)

  function handleBarcodeScan(result: BarcodeScanningResult) {
    if (scanned) return
    setScanned(true)
    // Debounce: re-enable after 500ms in case parent doesn't unmount
    setTimeout(() => setScanned(false), 500)
    onScan(result.data)
  }

  // Permission not yet determined
  if (!permission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>Kamera wird initialisiert…</Text>
      </View>
    )
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>Kamera-Zugriff wird benötigt</Text>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Berechtigung erteilen</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.buttonSecondary]} onPress={onClose}>
          <Text style={styles.buttonTextSecondary}>Abbrechen</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScan}
      />

      {/* Close button */}
      <Pressable style={styles.closeButton} onPress={onClose}>
        <Text style={styles.closeButtonText}>✕</Text>
      </Pressable>

      {/* Overlay hint */}
      <View style={styles.hintContainer}>
        <Text style={styles.hintText}>QR-Code in den Rahmen halten…</Text>
      </View>

      {/* Scan frame overlay */}
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
    backgroundColor: '#f97316',
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
    borderColor: 'rgba(249,115,22,0.8)',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
})
