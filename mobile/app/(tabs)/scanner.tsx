import React, { useState } from 'react'
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import ScannerCamera from '@/components/ScannerCamera'
import { isRecipeJSONQR, decodeRecipeFromCompactJSON, parseCompactRecipeToFull } from '@/utils/recipe-qr'
import type { RecipeQRData } from '@/utils/recipe-qr'
import { getServerUrl } from '@/utils/server-url'

export default function ScannerScreen() {
  const { autoOpen } = useLocalSearchParams<{ autoOpen?: string }>()
  const [showCamera, setShowCamera] = useState(autoOpen === 'true')

  const [scannedRecipe, setScannedRecipe] = useState<RecipeQRData | null>(null)
  const [importing, setImporting] = useState(false)

  async function handleScan(value: string) {
    setShowCamera(false)

    // Direktlink aus PDF/Karte: "<serverUrl>/recipe/<id>"
    const serverUrl = await getServerUrl()
    const recipeUrlPattern = /\/recipe\/(\d+)$/
    const urlMatch = value.match(recipeUrlPattern)
    if (urlMatch) {
      router.push(`/recipe/${urlMatch[1]}`)
      return
    }

    // Legacy: kompaktes Rezept-JSON (für QR-Codes die mit älteren Versionen erstellt wurden)
    if (!isRecipeJSONQR(value)) {
      Alert.alert('Kein Rezept-QR', 'Dieser QR-Code enthält kein RecipeDeck-Rezept.')
      return
    }

    const decoded = decodeRecipeFromCompactJSON(value)
    if (!decoded) {
      Alert.alert('Fehler', 'QR-Code konnte nicht gelesen werden.')
      return
    }

    // Prüfen ob Rezept schon vorhanden → direkt navigieren
    try {
      const res = await fetch(`${serverUrl}/api/v1/recipes`)
      if (res.ok) {
        const data = await res.json()
        const list: Array<{ id: number; name: string }> = Array.isArray(data) ? data : (data.recipes ?? [])
        const found = list.find(r => r.name === decoded.n)
        if (found) {
          router.push(`/recipe/${found.id}`)
          return
        }
      }
    } catch {
      // fall through to import offer
    }

    setScannedRecipe(parseCompactRecipeToFull(decoded))
  }

  async function handleImport() {
    if (!scannedRecipe) return

    setImporting(true)
    try {
      const serverUrl = await getServerUrl()
      const res = await fetch(`${serverUrl}/api/v1/recipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: scannedRecipe.name,
          emoji: scannedRecipe.emoji ?? '🍽️',
          ingredients: scannedRecipe.ingredients,
          steps: scannedRecipe.steps,
          tags: scannedRecipe.tags ?? [],
          servings: scannedRecipe.servings ?? null,
          duration: scannedRecipe.duration ?? null,
        }),
      })
      if (!res.ok) throw new Error(`Server-Fehler ${res.status}`)
      setScannedRecipe(null)
      Alert.alert('Importiert!', `"${scannedRecipe.name}" wurde gespeichert.`)
    } catch (err) {
      console.error('Import failed:', err)
      Alert.alert('Fehler', 'Rezept konnte nicht gespeichert werden.')
    } finally {
      setImporting(false)
    }
  }

  if (showCamera) {
    return (
      <ScannerCamera
        onScan={handleScan}
        onClose={() => setShowCamera(false)}
      />
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-warm-50 dark:bg-espresso-900">
      <ScrollView className="flex-1 px-4 pt-6">
        {/* Header */}
        <View className="mb-8">
          <Text className="text-2xl font-bold text-warm-900">QR-Code scannen</Text>
          <Text className="text-warm-500 mt-1">Rezept aus einem QR-Code importieren</Text>
        </View>

        {/* Scanned recipe preview */}
        {scannedRecipe ? (
          <View className="bg-white rounded-2xl shadow-sm border border-warm-200 p-5 mb-6">
            <Text className="text-sm font-medium text-warm-500 mb-3">Gefundenes Rezept</Text>

            <Text className="text-2xl font-bold text-warm-900 mb-2">
              {scannedRecipe.emoji} {scannedRecipe.name}
            </Text>

            <Text className="text-sm text-warm-500 mb-1">
              {scannedRecipe.ingredients.length} Zutaten · {scannedRecipe.steps.length} Schritte
              {scannedRecipe.rating ? ` · ${'★'.repeat(scannedRecipe.rating)}` : ''}
            </Text>

            {scannedRecipe.duration ? (
              <Text className="text-sm text-warm-500 mb-4">{scannedRecipe.duration}</Text>
            ) : (
              <View className="mb-4" />
            )}

            {/* Ingredients preview (first 3) */}
            <View className="bg-warm-50 rounded-xl p-3 mb-4">
              <Text className="text-xs font-semibold text-warm-500 uppercase tracking-wider mb-2">
                Zutaten
              </Text>
              {scannedRecipe.ingredients.slice(0, 3).map((ing, i) => (
                <Text key={i} className="text-sm text-warm-700">• {ing}</Text>
              ))}
              {scannedRecipe.ingredients.length > 3 && (
                <Text className="text-sm text-warm-500 mt-1">
                  + {scannedRecipe.ingredients.length - 3} weitere
                </Text>
              )}
            </View>

            <View className="flex-row gap-3">
              <Pressable
                onPress={handleImport}
                disabled={importing}
                className="flex-1 bg-primary-500 rounded-xl py-3 items-center justify-center"
              >
                {importing ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-semibold text-base">Importieren</Text>
                )}
              </Pressable>
              <Pressable
                onPress={() => setScannedRecipe(null)}
                className="px-5 py-3 border border-warm-200 rounded-xl items-center justify-center"
              >
                <Text className="text-warm-600 font-medium">Abbrechen</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          /* Camera button */
          <Pressable
            onPress={() => setShowCamera(true)}
            className="w-full bg-primary-500 rounded-xl py-4 items-center justify-center flex-row gap-3"
          >
            <Text className="text-white font-semibold text-lg">Kamera öffnen</Text>
          </Pressable>
        )}

        {/* Info hint */}
        {!scannedRecipe && (
          <Text className="text-center text-warm-500 text-sm mt-6">
            Halte die Kamera auf einen RecipeDeck-QR-Code,{'\n'}um ein Rezept zu importieren.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
