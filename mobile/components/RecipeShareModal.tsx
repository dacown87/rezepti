import { useState } from 'react';
import { View, Text, Pressable, Modal, TextInput, ActivityIndicator } from 'react-native';
import { Mail, Send } from 'lucide-react-native';
import QRCodeSVG from 'react-native-qrcode-svg';
import * as Linking from 'expo-linking';

import type { Recipe } from '@/db/schema';
import { encodeRecipeToCompactJSON } from '@/utils/recipe-qr';
import { shareText, type ShareOutcome } from '@/utils/share';
import type { CreatedRecipeShareInvite } from '@/utils/api';

function parseJSON<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

interface RecipeShareModalProps {
  visible: boolean;
  onClose: () => void;
  recipe: Recipe;
  onCreateInvite: (email: string) => Promise<CreatedRecipeShareInvite>;
}

/**
 * One dialog for every "give this recipe to someone else" path — QR (offline
 * import, no account needed, no ongoing link), plain text share (a copy, no
 * link, no binding), and the email invite (bound to one address, creates a
 * private copy for the recipient on accept). Copying into the caller's own
 * household or private space is a different intent and stays inline on the
 * recipe screen, not here.
 *
 * The mutation call and the offline-check gate for the invite stay owned by
 * the caller (passed in as `onCreateInvite`); this component only owns the
 * invite input and the resulting share feedback.
 */
export function RecipeShareModal({ visible, onClose, recipe, onCreateInvite }: RecipeShareModalProps) {
  const [qrShareFeedback, setQrShareFeedback] = useState<'copied' | 'unavailable' | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [invitePending, setInvitePending] = useState(false);

  if (!visible) return null;

  const handleClose = () => {
    setQrShareFeedback(null);
    onClose();
  };

  const ingredients = parseJSON<string[]>(recipe.ingredients, []);
  const steps = parseJSON<string[]>(recipe.steps, []);
  const tags = parseJSON<string[]>(recipe.tags, []);
  const qrData = encodeRecipeToCompactJSON({
    name: recipe.name,
    emoji: recipe.emoji ?? '',
    ingredients,
    steps,
    tags,
    rating: recipe.rating ?? undefined,
    servings: recipe.servings ?? undefined,
    duration: recipe.duration ?? undefined,
  });

  const handleShareText = async () => {
    const lines = [`${recipe.emoji ?? '🍽️'} ${recipe.name}`, ''];
    if (ingredients.length > 0) {
      lines.push('Zutaten:');
      ingredients.forEach(ing => lines.push(`• ${ing}`));
      lines.push('');
    }
    if (steps.length > 0) {
      lines.push('Zubereitung:');
      steps.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
      lines.push('');
    }
    lines.push('Geteilt aus RecipeDeck');
    const outcome = await shareText({ title: recipe.name, message: lines.join('\n') });
    // 'shared' and 'dismissed' both mean the share sheet handled it — the user
    // needs no extra message in either case.
    setQrShareFeedback(outcome === 'shared' || outcome === 'dismissed' ? null : outcome);
  };

  const handleSendInvite = async () => {
    const email = inviteEmail.trim();
    if (!email || invitePending) return;
    setInviteError(null);
    setInviteFeedback(null);
    setInvitePending(true);
    try {
      const invite = await onCreateInvite(email);
      setInviteEmail('');
      const url = invite.shareUrl ?? Linking.createURL(`/share-invite/${invite.token}`);

      let shareOutcome: ShareOutcome | null = null;
      if (invite.delivery?.status !== 'sent') {
        // shareText never throws — see mobile/utils/share.ts.
        shareOutcome = await shareText({ title: recipe.name, message: url });
      }

      if (invite.delivery?.status === 'sent') {
        setInviteFeedback('Einladung gesendet. Beim Annehmen entsteht eine private Kopie.');
        return;
      }

      const prefix = invite.delivery?.status === 'failed'
        ? 'Einladung erstellt, E-Mail-Versand fehlgeschlagen.'
        : 'Einladung erstellt.';
      if (shareOutcome === 'copied') {
        setInviteFeedback(`${prefix} Link wurde in die Zwischenablage kopiert.`);
      } else if (shareOutcome === 'unavailable') {
        // No share sheet and no clipboard — the only way to hand the recipient
        // the link is to show it in the feedback text itself (there is no
        // dedicated "invite link" UI element in this dialog to point to).
        setInviteFeedback(`${prefix} Link zum manuellen Teilen: ${url}`);
      } else {
        setInviteFeedback(`${prefix} Link kann manuell geteilt werden.`);
      }
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'Einladung konnte nicht erstellt werden.');
    } finally {
      setInvitePending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View className="flex-1 bg-black/60 items-center justify-center px-8">
        <View className="bg-white dark:bg-espresso-800 rounded-2xl p-6 w-full items-center">
          <Text className="text-lg font-bold text-warm-900 dark:text-warm-50 mb-1">{recipe.emoji ?? '🍽️'} {recipe.name}</Text>
          <Text className="text-xs text-warm-500 dark:text-warm-400 mb-5 text-center">QR-Code scannen um das Rezept{'\n'}in RecipeDeck zu importieren</Text>
          {qrData ? (
            <QRCodeSVG value={qrData} size={200} color="#111827" backgroundColor="#ffffff" />
          ) : (
            <Text className="text-warm-500 dark:text-warm-400 text-sm">Rezept zu groß für QR-Code</Text>
          )}
          <Text className="text-[11px] text-warm-400 dark:text-warm-500 mt-2 text-center">
            Kein Konto nötig, kein Rückbezug
          </Text>
          <View className="flex-row gap-3 mt-4 w-full">
            <Pressable onPress={handleShareText} className="flex-1 py-3 rounded-xl bg-primary-500 items-center">
              <Text className="text-white text-sm font-semibold">Als Text teilen</Text>
            </Pressable>
            <Pressable onPress={handleClose} className="flex-1 py-3 rounded-xl bg-warm-100 dark:bg-espresso-800 items-center">
              <Text className="text-warm-700 dark:text-warm-200 text-sm font-medium">Schließen</Text>
            </Pressable>
          </View>
          {qrShareFeedback === 'copied' && (
            <Text className="text-xs text-green-700 mt-3 text-center" testID="qr-share-feedback">
              Rezept in die Zwischenablage kopiert.
            </Text>
          )}
          {qrShareFeedback === 'unavailable' && (
            <Text className="text-xs text-red-600 mt-3 text-center" testID="qr-share-feedback">
              Teilen wird von diesem Browser nicht unterstützt.
            </Text>
          )}

          <View className="w-full mt-5 pt-5 border-t border-warm-100 dark:border-warm-700 gap-2">
            <View className="flex-row items-center gap-2">
              <Mail size={18} color="#C84B31" />
              <Text className="text-sm font-medium text-warm-900 dark:text-warm-50">An Person schicken</Text>
            </View>
            <Text className="text-[11px] text-warm-400 dark:text-warm-500">
              Bindet sich an eine Adresse; erzeugt beim Annehmen eine private Kopie
            </Text>
            <View className="flex-row gap-2">
              <TextInput
                value={inviteEmail}
                onChangeText={setInviteEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="email@example.com"
                placeholderTextColor="#9E8878"
                testID="recipe-share-invite-email"
                className="flex-1 border border-warm-200 dark:border-warm-700 rounded-xl px-3 py-2.5 text-sm text-warm-900 dark:text-warm-50"
              />
              <Pressable
                onPress={handleSendInvite}
                disabled={!inviteEmail.trim() || invitePending}
                testID="recipe-share-invite-send"
                className={`w-12 items-center justify-center rounded-xl ${inviteEmail.trim() ? 'bg-primary-500' : 'bg-warm-200'}`}
              >
                {invitePending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Send size={17} color={inviteEmail.trim() ? '#fff' : '#9E8878'} />}
              </Pressable>
            </View>
            {inviteError && (
              <Text className="text-xs text-red-600" testID="recipe-share-invite-error">{inviteError}</Text>
            )}
            {inviteFeedback && (
              <Text className="text-xs text-green-700" testID="recipe-share-invite-feedback">{inviteFeedback}</Text>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
