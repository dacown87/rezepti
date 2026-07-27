export type RecipeInviteDeliveryStatus = "sent" | "skipped" | "failed";
export type RecipeInviteDeliveryProvider = "disabled" | "brevo";
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

interface BrevoResponse {
  messageId?: string;
  message?: string;
  name?: string;
}

function resolveRecipeInviteMailConfig() {
  const provider = (process.env.RECIPE_INVITE_EMAIL_PROVIDER || "").trim().toLowerCase();
  const brevoApiKey = (process.env.BREVO_API_KEY || "").trim();
  const from = (process.env.RECIPE_INVITE_EMAIL_FROM || "").trim();
  const replyTo = (process.env.RECIPE_INVITE_EMAIL_REPLY_TO || "").trim();

  if (provider && provider !== "brevo") {
    return { enabled: false as const };
  }

  if (!brevoApiKey || !from) {
    return { enabled: false as const };
  }

  return {
    enabled: true as const,
    brevoApiKey,
    from,
    replyTo: replyTo || undefined,
  };
}

interface Mailbox {
  email: string;
  name?: string;
}

function parseMailbox(value: string): Mailbox {
  const trimmed = value.trim();
  const named = trimmed.match(/^(.+?)\s*<([^<>\s]+@[^<>\s]+)>$/);
  if (named) {
    return { name: named[1].trim(), email: named[2] };
  }
  return { email: trimmed };
}

function buildRecipeInviteText(input: RecipeInviteEmailInput) {
  const sender = input.senderEmail ? `${input.senderEmail} hat` : "Jemand hat";
  return [
    `${sender} ein Rezept mit dir geteilt: ${input.recipeName}`,
    "",
    "Oeffne den Link, melde dich mit dieser E-Mail-Adresse an und nimm die Einladung an.",
    input.shareUrl,
    "",
    "Beim Annehmen entsteht eine private Kopie in deinem RecipeDeck-Konto.",
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
    `<p>Beim Annehmen entsteht eine private Kopie in deinem RecipeDeck-Konto.</p>`,
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
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "api-key": config.brevoApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: parseMailbox(config.from),
        to: [{ email: input.to }],
        replyTo: config.replyTo ? parseMailbox(config.replyTo) : undefined,
        subject: `Rezept-Einladung: ${input.recipeName}`,
        textContent: buildRecipeInviteText(input),
        htmlContent: buildRecipeInviteHtml(input),
      }),
    });

    if (response.ok) {
      return { status: "sent", provider: "brevo" };
    }

    const body = await response.json().catch(() => null) as BrevoResponse | null;
    const errorCode: RecipeInviteDeliveryErrorCode = response.status >= 500
      ? "provider_unavailable"
      : "provider_rejected";
    console.warn("Recipe invite email provider responded with an error", {
      status: response.status,
      provider: "brevo",
      providerError: body?.name ?? body?.message ?? "unknown",
    });
    return { status: "failed", provider: "brevo", errorCode };
  } catch (error) {
    console.warn("Recipe invite email provider unavailable", {
      provider: "brevo",
      error: error instanceof Error ? error.message : "unknown",
    });
    return { status: "failed", provider: "brevo", errorCode: "provider_unavailable" };
  }
}
