import { useState } from 'react';
import { View, Text, Pressable, Modal, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { X, Plus, Check, FolderPlus, Star } from 'lucide-react-native';

import {
  useCollections,
  useCreateCollection,
  useAddRecipeToCollection,
  type Collection,
} from '@/hooks/useCollections';
import { ApiRequestError } from '@/utils/api';
import { fetchAuthMe } from '@/utils/admin';

type AddState =
  | { kind: 'idle' }
  | { kind: 'pending'; collectionId: string }
  | { kind: 'added'; collectionId: string }
  | { kind: 'duplicate'; collectionId: string }
  | { kind: 'error'; message: string };

/**
 * Picker modal: lists the user's collections and adds the given recipe to a
 * tapped collection. Includes a "Neue Collection" affordance (create → add).
 *
 * UI states surfaced (never crashes):
 *  - already in collection (hook returns { added:false }) → friendly note
 *  - not-found / illegal (ApiRequestError) → inline error message
 */
export function AddToCollectionModal({
  visible,
  recipeId,
  recipeScope,
  onClose,
}: {
  visible: boolean;
  recipeId: number;
  recipeScope?: 'private' | 'household';
  onClose: () => void;
}) {
  const collectionsQuery = useCollections();
  const createCollection = useCreateCollection();
  const addToCollection = useAddRecipeToCollection();
  const authMeQuery = useQuery({
    queryKey: ['auth-me', 'collection-target-picker'],
    queryFn: fetchAuthMe,
    enabled: visible,
  });

  const [state, setState] = useState<AddState>({ kind: 'idle' });
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | null>(null);

  // Exclude the system Favoriten collection: favorites are managed by the
  // dedicated heart toggle (which invalidates the recipe/list keys so the heart
  // lights up). Adding here would only invalidate the collections key and leave
  // the list/detail heart stale, so we hide it from the add-list entirely.
  const memberships = authMeQuery.data?.memberships ?? [];
  const defaultHouseholdId = authMeQuery.data?.activeHouseholdId ?? memberships[0]?.householdId ?? null;
  const targetHouseholdId = selectedHouseholdId ?? defaultHouseholdId;
  const showHouseholdPicker = recipeScope === 'private' && memberships.length > 1;
  const householdLabel = (householdId: string) => {
    const index = memberships.findIndex((membership) => membership.householdId === householdId);
    return `Haushalt ${index >= 0 ? index + 1 : ''}`.trim();
  };

  const collections = (collectionsQuery.data ?? []).filter((c) => {
    if (c.is_system) return false;
    if (c.owner_type !== 'household') return true;
    if (!targetHouseholdId) return true;
    return c.household_id === targetHouseholdId;
  });

  const reset = () => {
    setState({ kind: 'idle' });
    setShowCreate(false);
    setNewName('');
    setSelectedHouseholdId(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const messageFor = (error: unknown): string => {
    if (error instanceof ApiRequestError) {
      if (error.status === 404) return 'Sammlung oder Rezept nicht gefunden.';
      if (error.status === 400) return 'Aktion nicht möglich.';
      return error.message;
    }
    return 'Etwas ist schiefgelaufen. Bitte erneut versuchen.';
  };

  const addRecipe = async (collectionId: string) => {
    setState({ kind: 'pending', collectionId });
    try {
      const collection = collections.find((c) => c.id === collectionId);
      const targetHouseholdId = collection?.owner_type === 'household' ? collection.household_id ?? undefined : undefined;
      const { added } = await addToCollection.mutateAsync({ collectionId, recipeId, targetHouseholdId });
      setState(added ? { kind: 'added', collectionId } : { kind: 'duplicate', collectionId });
    } catch (error) {
      setState({ kind: 'error', message: messageFor(error) });
    }
  };

  const handleCreateAndAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setState({ kind: 'pending', collectionId: '__new__' });
    try {
      const createAsHousehold = recipeScope === 'private' && !!targetHouseholdId;
      const created = await createCollection.mutateAsync({
        name,
        ...(createAsHousehold ? { ownerType: 'household' as const, householdId: targetHouseholdId } : {}),
      });
      const { added } = await addToCollection.mutateAsync({
        collectionId: created.id,
        recipeId,
        ...(createAsHousehold ? { targetHouseholdId: targetHouseholdId } : {}),
      });
      setShowCreate(false);
      setNewName('');
      setState(added ? { kind: 'added', collectionId: created.id } : { kind: 'duplicate', collectionId: created.id });
    } catch (error) {
      setState({ kind: 'error', message: messageFor(error) });
    }
  };

  const rowStatus = (c: Collection): string | null => {
    if (state.kind === 'added' && state.collectionId === c.id) return 'Hinzugefügt';
    if (state.kind === 'duplicate' && state.collectionId === c.id) return 'Bereits enthalten';
    return null;
  };

  const createsHouseholdCopy = (c: Collection) =>
    recipeScope === 'private' && c.owner_type === 'household';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View className="flex-1 bg-black/50 items-center justify-center px-6">
        <View className="bg-white dark:bg-espresso-800 rounded-2xl w-full max-w-md max-h-[80%]">
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
            <Text className="text-lg font-bold text-warm-900 dark:text-warm-50">Zu Collection hinzufügen</Text>
            <Pressable onPress={handleClose} accessibilityRole="button" accessibilityLabel="Schließen" className="p-1">
              <X size={20} color="#9E8878" />
            </Pressable>
          </View>

          {state.kind === 'error' && (
            <View className="mx-4 mb-2 rounded-xl bg-red-50 px-3 py-2">
              <Text className="text-red-600 text-sm">{state.message}</Text>
            </View>
          )}

          {showHouseholdPicker && (
            <View className="px-4 pb-2">
              <View className="flex-row flex-wrap gap-2">
                {memberships.map((membership) => {
                  const selected = membership.householdId === targetHouseholdId;
                  return (
                    <Pressable
                      key={membership.householdId}
                      onPress={() => {
                        setSelectedHouseholdId(membership.householdId);
                        setState({ kind: 'idle' });
                      }}
                      testID={`household-target-${membership.householdId}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      className={`px-3 py-1.5 rounded-full border ${selected ? 'bg-primary-500 border-primary-500' : 'bg-white dark:bg-espresso-800 border-warm-200 dark:border-warm-700'}`}
                    >
                      <Text className={`text-xs font-medium ${selected ? 'text-white' : 'text-warm-600 dark:text-warm-300'}`}>
                        {householdLabel(membership.householdId)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {collectionsQuery.isLoading ? (
            <View className="py-10 items-center">
              <ActivityIndicator size="small" color="#C84B31" />
            </View>
          ) : collectionsQuery.isError ? (
            <View className="px-4 py-8 items-center">
              <Text className="text-warm-500 dark:text-warm-400 text-sm text-center">
                Sammlungen konnten nicht geladen werden.
              </Text>
              <Pressable onPress={() => collectionsQuery.refetch()} className="mt-3 px-4 py-2 bg-primary-500 rounded-xl">
                <Text className="text-white text-sm font-medium">Erneut versuchen</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView className="px-2" style={{ flexGrow: 0 }}>
              {collections.length === 0 ? (
                <Text className="text-warm-500 dark:text-warm-400 text-sm text-center py-6 px-4">
                  Noch keine Collections. Lege unten eine neue an.
                </Text>
              ) : (
                collections.map((c) => {
                  const status = rowStatus(c);
                  const pending = state.kind === 'pending' && state.collectionId === c.id;
                  const copyToHousehold = createsHouseholdCopy(c);
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => addRecipe(c.id)}
                      disabled={pending}
                      accessibilityRole="button"
                      accessibilityLabel={`${c.name} – Rezept hinzufügen`}
                      testID={`collection-row-${c.id}`}
                      className="flex-row items-center px-3 py-3 mx-2 my-1 rounded-xl border border-warm-100 dark:border-warm-700"
                    >
                      {c.is_system ? (
                        <Star size={16} color="#D4A853" fill="#D4A853" />
                      ) : (
                        <FolderPlus size={16} color="#9E8878" />
                      )}
                      <View className="flex-1 ml-3">
                        <Text className="text-sm font-medium text-warm-900 dark:text-warm-50">{c.name}</Text>
                        <Text className="text-xs text-warm-500 dark:text-warm-400">
                          {copyToHousehold
                            ? `Als Haushaltskopie in ${householdLabel(c.household_id ?? '')} hinzufügen`
                            : `${c.item_count} ${c.item_count === 1 ? 'Rezept' : 'Rezepte'}`}
                        </Text>
                      </View>
                      {pending ? (
                        <ActivityIndicator size="small" color="#C84B31" />
                      ) : status ? (
                        <View className="flex-row items-center gap-1">
                          <Check size={14} color="#16a34a" />
                          <Text className="text-xs text-green-600">{status}</Text>
                        </View>
                      ) : (
                        <Plus size={18} color="#C84B31" />
                      )}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          )}

          {/* Neue Collection */}
          <View className="px-4 py-3 border-t border-warm-100 dark:border-warm-700">
            {showCreate ? (
              <View className="gap-2">
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Name der Collection"
                  placeholderTextColor="#9E8878"
                  autoFocus
                  testID="new-collection-input"
                  className="border border-warm-200 dark:border-warm-700 rounded-xl px-3 py-2.5 text-sm text-warm-900 dark:text-warm-50"
                />
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={handleCreateAndAdd}
                    disabled={!newName.trim() || state.kind === 'pending'}
                    testID="create-collection-confirm"
                    className={`flex-1 py-2.5 rounded-xl items-center ${newName.trim() ? 'bg-primary-500' : 'bg-warm-200'}`}
                  >
                    {state.kind === 'pending' && state.collectionId === '__new__' ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text className={`text-sm font-semibold ${newName.trim() ? 'text-white' : 'text-warm-500'}`}>
                        {recipeScope === 'private' && targetHouseholdId ? 'Haushalts-Collection erstellen' : 'Erstellen & hinzufügen'}
                      </Text>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => { setShowCreate(false); setNewName(''); }}
                    className="px-4 py-2.5 rounded-xl border border-warm-200 dark:border-warm-700 items-center"
                  >
                    <Text className="text-sm text-warm-600 dark:text-warm-300">Abbrechen</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => { setShowCreate(true); setState({ kind: 'idle' }); }}
                testID="new-collection-open"
                className="flex-row items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-primary-300"
              >
                <Plus size={16} color="#C84B31" />
                <Text className="text-sm font-medium text-primary-500">Neue Collection</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
