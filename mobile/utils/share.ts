// Cross-platform "share this text" helper.
//
// Why this exists: react-native-web's Share.share() only works when
// window.navigator.share (the Web Share API) is present. Linux desktop
// Chromium (and some other desktop browsers) never implement it, so
// Share.share() rejects on every call there — even though the exact same
// PWA works fine on Android/iOS/macOS Safari where Share.share() delegates
// to a real native share sheet. Do NOT replace this with a plain
// Share.share() call "for simplicity" — that regresses Linux desktop users
// back to a silent no-op.
//
// On native (iOS/Android), Share.share() always succeeds when available, so
// the clipboard fallback below never runs there. We deliberately feature-detect
// (Share.share failing) instead of branching on Platform.OS, so a desktop
// browser that gains Web Share support in the future just works without a
// code change here.
import { Share } from 'react-native';

export type ShareOutcome = 'shared' | 'dismissed' | 'copied' | 'unavailable';

export interface ShareTextInput {
  title?: string;
  message: string;
}

export async function shareText(input: ShareTextInput): Promise<ShareOutcome> {
  try {
    await Share.share({ title: input.title, message: input.message });
    return 'shared';
  } catch (error) {
    // A user who opens the share sheet and cancels gets an AbortError from
    // navigator.share. That is a completed interaction, not a missing
    // capability — falling through to the clipboard here would silently
    // overwrite it and then claim "copied" for something the user just
    // declined. Native Share.share resolves with dismissedAction instead of
    // rejecting, so this branch is web-only in practice.
    if (error instanceof Error && error.name === 'AbortError') {
      return 'dismissed';
    }
    // Any other rejection means the Web Share API is absent or refused the
    // payload — fall through to the clipboard fallback below.
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(input.message);
      return 'copied';
    }
  } catch {
    // Clipboard write failed (e.g. no secure context, permission denied) — unavailable.
  }

  return 'unavailable';
}
