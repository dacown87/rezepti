import React, { useState } from 'react'
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import ScannerCamera from '@/components/ScannerCamera'
import { isRecipeJSONQR, decodeRecipeFromCompactJSON, parseCompactRecipeToFull } from '@/utils/recipe-qr'
import type { RecipeQRData } from '@/utils/recipe-qr'
import { getDB } from '@/db/migrate'

export default function ScannerScreen() {
  const [showCamera, setShowCamera] = useState(false)
  const [scannedRecipe, setScannedRecipe] = useState<RecipeQRData | null>(null)
  const [importing, setImporting] = useState(false)

  function handleScan(value: string) {
    setShowCamera(false)

    if (!isRecipeJSONQR(value)) {
      Alert.alert('Kein Rezept-QR', 'Dieser QR-Code enthält kein RecipeDeck-Rezept.')
      return
    }

    const decoded = decodeRecipeFromCompactJSON(value)
    if (!decoded) {
      Alert.alert('Fehler', 'QR-Code konnte nicht gelesen werden.')
      return
    }

    setScannedRecipe(parseCompactRecipeToFull(decoded))
  }

  async function handleImport() {
    if (!scannedRecipe) return

    setImporting(true)
    try {
      const db = getDB()
      await db.runAsync(
        `INSERT INTO recipes (name, emoji, ingredients, steps, tags, servings, duration) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        scannedRecipe.name,
        scannedRecipe.emoji ?? '🍽️',
        JSON.stringify(scannedRecipe.ingredients),
        JSON.stringify(scannedRecipe.steps),
        JSON.stringify(scannedRecipe.tags ?? []),
        scannedRecipe.servings ?? null,
        scannedRecipe.duration ?? null
      )
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
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1 px-4 pt-6">
        {/* Header */}
        <View className="mb-8">
          <Text className="text-2xl font-bold text-gray-900">QR-Code scannen</Text>
          <Text className="text-gray-500 mt-1">Rezept aus einem QR-Code importieren</Text>
        </View>

        {/* Scanned recipe preview */}
        {scannedRecipe ? (
          <View className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
            <Text className="text-sm font-medium text-gray-500 mb-3">Gefundenes Rezept</Text>

            <Text className="text-2xl font-bold text-gray-900 mb-2">
              {scannedRecipe.emoji} {scannedRecipe.name}
            </Text>

            <Text className="text-sm text-gray-500 mb-1">
              {scannedRecipe.ingredients.length} Zutaten · {scannedRecipe.steps.length} Schritte
              {scannedRecipe.rating ? ` · ${'★'.repeat(scannedRecipe.rating)}` : ''}
            </Text>

            {scannedRecipe.duration ? (
              <Text className="text-sm text-gray-500 mb-4">{scannedRecipe.duration}</Text>
            ) : (
              <View className="mb-4" />
            )}

            {/* Ingredients preview (first 3) */}
            <View className="bg-gray-50 rounded-xl p-3 mb-4">
              <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Zutaten
              </Text>
              {scannedRecipe.ingredients.slice(0, 3).map((ing, i) => (
                <Text key={i} className="text-sm text-gray-700">• {ing}</Text>
              ))}
              {scannedRecipe.ingredients.length > 3 && (
                <Text className="text-sm text-gray-400 mt-1">
                  + {scannedRecipe.ingredients.length - 3} weitere
                </Text>
              )}
            </View>

            <View className="flex-row gap-3">
              <Pressable
                onPress={handleImport}
                disabled={importing}
                className="flex-1 bg-orange-500 rounded-xl py-3 items-center justify-center"
              >
                {importing ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-semibold text-base">Importieren</Text>
                )}
              </Pressable>
              <Pressable
                onPress={() => setScannedRecipe(null)}
                className="px-5 py-3 border border-gray-200 rounded-xl items-center justify-center"
              >
                <Text className="text-gray-600 font-medium">Abbrechen</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          /* Camera button */
          <Pressable
            onPress={() => setShowCamera(true)}
            className="w-full bg-orange-500 rounded-xl py-4 items-center justify-center flex-row gap-3"
          >
            <Text className="text-white font-semibold text-lg">Kamera öffnen</Text>
          </Pressable>
        )}

        {/* Info hint */}
        {!scannedRecipe && (
          <Text className="text-center text-gray-400 text-sm mt-6">
            Halte die Kamera auf einen RecipeDeck-QR-Code,{'\n'}um ein Rezept zu importieren.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
