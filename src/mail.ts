export type RecipeInviteDeliveryStatus = "sent" | "skipped" | "failed";
export type RecipeInviteDeliveryProvider = "disabled" | "resend";
export type RecipeInviteDeliveryErrorCode =
  | "mail_not_configured"
  | "provider_rejected"
  | "provider_unavailable";

export interface RecipeInviteDelivery {
  status: RecipeInviteDeliveryStatus;
  provider: RecipeInviteDeliveryProvider;
  errorCode?: RecipeInviteDeliveryErrorCode;
}

export interface RecipeInviteEmailInput {
  to: string;
  recipeName: string;
  senderEmail: string | null;
  shareUrl: string;
}

interface ResendResponse {
  id?: string;
  message?: string;
  name?: string;
}

function resolveRecipeInviteMailConfig() {
  const provider = (process.env.RECIPE_INVITE_EMAIL_PROVIDER || "").trim().toLowerCase();
  const resendApiKey = (process.env.RESEND_API_KEY || "").trim();
  const from = (process.env.RECIPE_INVITE_EMAIL_FROM || "").trim();
  const replyTo = (process.env.RECIPE_INVITE_EMAIL_REPLY_TO || "").trim();

  if (provider && provider !== "resend") {
    return { enabled: false as const };
  }

  if (!resendApiKey || !from) {
    return { enabled: false as const };
  }

  return {
    enabled: true as const,
    resendApiKey,
    from,
    replyTo: replyTo || undefined,
  };
}

function buildRecipeInviteText(input: RecipeInviteEmailInput) {
  const sender = input.senderEmail ? `${input.senderEmail} hat` : "Jemand hat";
  return [
    `${sender} ein Rezept mit dir geteilt: ${input.recipeName}`,
    "",
    "Oeffne den Link, melde dich mit dieser E-Mail-Adresse an und nimm die Einladung an.",
    input.shareUrl,
    "",
    "Beim Annehmen entsteht eine private Kopie in deinem Rezepti-Konto.",
  ].join("\n");
}

function buildRecipeInviteHtml(input: RecipeInviteEmailInput) {
  const sender = input.senderEmail ? `${input.senderEmail} hat` : "Jemand hat";
  const escapedRecipeName = escapeHtml(input.recipeName);
  const escapedShareUrl = escapeHtml(input.shareUrl);
  return [
    `<p>${escapeHtml(sender)} ein Rezept mit dir geteilt: <strong>${escapedRecipeName}</strong></p>`,
    `<p>Oeffne den Link, melde dich mit dieser E-Mail-Adresse an und nimm die Einladung an.</p>`,
    `<p><a href="${escapedShareUrl}">Rezept-Einladung oeffnen</a></p>`,
    `<p>Beim Annehmen entsteht eine private Kopie in deinem Rezepti-Konto.</p>`,
  ].join("");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function sendRecipeInviteEmail(input: RecipeInviteEmailInput): Promise<RecipeInviteDelivery> {
  const config = resolveRecipeInviteMailConfig();
  if (!config.enabled) {
    return { status: "skipped", provider: "disabled", errorCode: "mail_not_configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: [input.to],
        reply_to: config.replyTo,
        subject: `Rezept-Einladung: ${input.recipeName}`,
        text: buildRecipeInviteText(input),
        html: buildRecipeInviteHtml(input),
      }),
    });

    if (response.ok) {
      return { status: "sent", provider: "resend" };
    }

    const body = await response.json().catch(() => null) as ResendResponse | null;
    console.warn("Recipe invite email rejected by provider", {
      status: response.status,
      provider: "resend",
      providerError: body?.name ?? body?.message ?? "unknown",
    });
    return { status: "failed", provider: "resend", errorCode: "provider_rejected" };
  } catch (error) {
    console.warn("Recipe invite email provider unavailable", {
      provider: "resend",
      error: error instanceof Error ? error.message : "unknown",
    });
    return { status: "failed", provider: "resend", errorCode: "provider_unavailable" };
  }
}
