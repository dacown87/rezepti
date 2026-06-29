import { useState } from 'react';
import {
  View, Text, FlatList, Pressable, TextInput, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Plus, Star, FolderOpen, Pencil, Trash2, X } from 'lucide-react-native';

import {
  useCollections,
  useCreateCollection,
  useRenameCollection,
  useDeleteCollection,
  type Collection,
} from '@/hooks/useCollections';
import { ApiRequestError } from '@/utils/api';

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 400) return 'Aktion nicht möglich.';
    if (error.status === 404) return 'Sammlung nicht gefunden.';
    return error.message;
  }
  return 'Etwas ist schiefgelaufen. Bitte erneut versuchen.';
}

// ── Rename modal ────────────────────────────────────────────────────────────
function RenameModal({
  collection, onClose,
}: { collection: Collection; onClose: () => void }) {
  const rename = useRenameCollection();
  const [name, setName] = useState(collection.name);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || rename.isPending) return;
    setError(null);
    try {
      await rename.mutateAsync({ id: collection.id, name: trimmed });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 items-center justify-center px-8">
        <View className="bg-white dark:bg-espresso-800 rounded-2xl p-6 w-full max-w-sm">
          <Text className="text-lg font-bold text-warm-900 dark:text-warm-50 mb-3">Collection umbenennen</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            autoFocus
            testID="rename-input"
            className="border border-warm-200 dark:border-warm-700 rounded-xl px-3 py-2.5 text-sm text-warm-900 dark:text-warm-50 mb-3"
          />
          {error && <Text className="text-red-600 text-sm mb-3">{error}</Text>}
          <View className="flex-row gap-3">
            <Pressable onPress={onClose} className="flex-1 py-3 rounded-xl border border-warm-200 dark:border-warm-700 items-center">
              <Text className="text-warm-700 dark:text-warm-200 font-medium">Abbrechen</Text>
            </Pressable>
            <Pressable
              onPress={submit}
              disabled={!name.trim() || rename.isPending}
              testID="rename-confirm"
              className={`flex-1 py-3 rounded-xl items-center ${name.trim() ? 'bg-primary-500' : 'bg-warm-200'}`}
            >
              {rename.isPending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text className={`font-semibold ${name.trim() ? 'text-white' : 'text-warm-500'}`}>Speichern</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Delete confirm modal ────────────────────────────────────────────────────
function DeleteCollectionModal({
  collection, onClose,
}: { collection: Collection; onClose: () => void }) {
  const del = useDeleteCollection();
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (del.isPending) return;
    setError(null);
    try {
      await del.mutateAsync(collection.id);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 items-center justify-center px-8">
        <View className="bg-white dark:bg-espresso-800 rounded-2xl p-6 w-full max-w-sm">
          <Text className="text-lg font-bold text-warm-900 dark:text-warm-50 mb-2">Collection löschen</Text>
          <Text className="text-warm-500 dark:text-warm-400 mb-1">„{collection.name}“ löschen?</Text>
          <Text className="text-warm-500 dark:text-warm-400 mb-6 text-sm">Die Rezepte bleiben erhalten, nur die Sammlung wird entfernt.</Text>
          {error && <Text className="text-red-600 text-sm mb-3">{error}</Text>}
          <View className="flex-row gap-3">
            <Pressable onPress={onClose} className="flex-1 py-3 rounded-xl border border-warm-200 dark:border-warm-700 items-center">
              <Text className="text-warm-700 dark:text-warm-200 font-medium">Abbrechen</Text>
            </Pressable>
            <Pressable onPress={submit} disabled={del.isPending} testID="delete-confirm" className="flex-1 py-3 rounded-xl bg-red-500 items-center">
              {del.isPending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text className="text-white font-semibold">Löschen</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Create form (inline) ────────────────────────────────────────────────────
function CreateCollectionForm() {
  const create = useCreateCollection();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || create.isPending) return;
    setError(null);
    try {
      await create.mutateAsync({ name: trimmed });
      setName('');
      setOpen(false);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  if (!open) {
    return (
      <Pressable
        onPress={() => setOpen(true)}
        testID="create-collection-open"
        className="flex-row items-center justify-center gap-2 py-3 rounded-xl bg-primary-500 mx-4 my-3"
      >
        <Plus size={18} color="#fff" />
        <Text className="text-white font-semibold text-sm">Neue Collection</Text>
      </Pressable>
    );
  }

  return (
    <View className="mx-4 my-3 gap-2">
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Name der Collection"
        placeholderTextColor="#9E8878"
        autoFocus
        testID="create-collection-input"
        className="border border-warm-200 dark:border-warm-700 rounded-xl px-3 py-2.5 text-sm text-warm-900 dark:text-warm-50"
      />
      {error && <Text className="text-red-600 text-sm">{error}</Text>}
      <View className="flex-row gap-2">
        <Pressable
          onPress={submit}
          disabled={!name.trim() || create.isPending}
          testID="create-collection-confirm"
          className={`flex-1 py-2.5 rounded-xl items-center ${name.trim() ? 'bg-primary-500' : 'bg-warm-200'}`}
        >
          {create.isPending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text className={`text-sm font-semibold ${name.trim() ? 'text-white' : 'text-warm-500'}`}>Erstellen</Text>}
        </Pressable>
        <Pressable onPress={() => { setOpen(false); setName(''); setError(null); }} className="px-4 py-2.5 rounded-xl border border-warm-200 dark:border-warm-700 items-center">
          <Text className="text-sm text-warm-600 dark:text-warm-300">Abbrechen</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Screen ──────────────────────────────────────────────────────────────────
export default function CollectionsScreen() {
  const collectionsQuery = useCollections();
  const [renaming, setRenaming] = useState<Collection | null>(null);
  const [deleting, setDeleting] = useState<Collection | null>(null);

  const collections = collectionsQuery.data ?? [];

  const renderItem = ({ item }: { item: Collection }) => (
    <View
      testID={`collection-item-${item.id}`}
      className="flex-row items-center bg-white dark:bg-espresso-800 rounded-2xl mb-3 border border-warm-200 dark:border-warm-700 px-4 py-3"
    >
      {item.is_system ? (
        <Star size={20} color="#D4A853" fill="#D4A853" />
      ) : (
        <FolderOpen size={20} color="#9E8878" />
      )}
      <View className="flex-1 ml-3">
        <Text className="text-base font-semibold text-warm-900 dark:text-warm-50">{item.name}</Text>
        <Text className="text-xs text-warm-500 dark:text-warm-400">
          {item.item_count} {item.item_count === 1 ? 'Rezept' : 'Rezepte'}
          {item.is_system ? ' · System' : ''}
        </Text>
      </View>
      {/* Favorites (is_system) cannot be renamed or deleted — hide controls. */}
      {!item.is_system && (
        <View className="flex-row items-center gap-1">
          <Pressable
            onPress={() => setRenaming(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.name} umbenennen`}
            testID={`rename-${item.id}`}
            className="p-2"
          >
            <Pencil size={16} color="#9E8878" />
          </Pressable>
          <Pressable
            onPress={() => setDeleting(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.name} löschen`}
            testID={`delete-${item.id}`}
            className="p-2"
          >
            <Trash2 size={16} color="#ef4444" />
          </Pressable>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-warm-50 dark:bg-espresso-900">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 bg-white dark:bg-espresso-800 border-b border-warm-200 dark:border-warm-700">
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Zurück" className="mr-3 p-1">
          <ArrowLeft size={22} color="#374151" />
        </Pressable>
        <Text className="text-base font-semibold text-warm-900 dark:text-warm-50 flex-1">Collections</Text>
      </View>

      <CreateCollectionForm />

      {collectionsQuery.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="collections-loading" size="large" color="#C84B31" />
        </View>
      ) : collectionsQuery.isError ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-red-500 text-center">Sammlungen konnten nicht geladen werden.</Text>
          <Pressable onPress={() => collectionsQuery.refetch()} className="mt-4 px-4 py-2 bg-primary-500 rounded-xl">
            <Text className="text-white text-sm font-medium">Erneut versuchen</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={collections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingTop: 4 }}
          ListEmptyComponent={
            <View className="items-center py-16">
              <FolderOpen size={40} color="#d1d5db" />
              <Text className="text-warm-500 dark:text-warm-400 text-sm text-center mt-3">
                Noch keine Collections.{'\n'}Lege oben eine neue an.
              </Text>
            </View>
          }
        />
      )}

      {renaming && <RenameModal collection={renaming} onClose={() => setRenaming(null)} />}
      {deleting && <DeleteCollectionModal collection={deleting} onClose={() => setDeleting(null)} />}
    </SafeAreaView>
  );
}
