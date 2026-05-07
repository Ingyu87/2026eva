import { decodeSignedToken, encodeSignedToken } from "./session";
import {
  AUDIENCES,
  AUDIENCE_LABELS,
  LIKERT_3_OPTIONS,
  LIKERT_5_OPTIONS,
  YES_NO_OPTIONS,
  type Audience,
  type GoogleFormInfo,
  type ResponseType,
  type SurveyDraft
} from "./types";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const FORMS_API_URL = "https://forms.googleapis.com/v1/forms";

type GoogleState = {
  role: "google_state";
  schoolId: string;
  schoolName: string;
  exp: number;
};

type TokenResponse = {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
};

type GoogleFormResponse = {
  formId: string;
  responderUri?: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`???? ${name}?(?) ???? ?? ????. .env.example? ?????.`);
  }
  return value;
}

export function getGoogleRedirectUri(requestOrigin?: string): string {
  return (
    process.env.GOOGLE_REDIRECT_URI ||
    (requestOrigin ? `${requestOrigin}/api/google/callback` : "")
  );
}

export function createGoogleAuthUrl(schoolId: string, schoolName: string, requestOrigin: string): string {
  const clientId = requiredEnv("GOOGLE_CLIENT_ID");
  const redirectUri = getGoogleRedirectUri(requestOrigin);
  if (!redirectUri) {
    throw new Error("OAuth ????? URI? ?? ? ????.");
  }

  const state = encodeSignedToken({
    role: "google_state",
    schoolId,
    schoolName,
    exp: Math.floor(Date.now() / 1000) + 60 * 10
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: "https://www.googleapis.com/auth/forms.body",
    state
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export function decodeGoogleState(state: string | null): GoogleState | null {
  const decoded = decodeSignedToken<GoogleState>(state ?? undefined);
  return decoded?.role === "google_state" ? decoded : null;
}

export async function exchangeGoogleCode(code: string, requestOrigin: string): Promise<TokenResponse> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: requiredEnv("GOOGLE_CLIENT_ID"),
      client_secret: requiredEnv("GOOGLE_CLIENT_SECRET"),
      redirect_uri: getGoogleRedirectUri(requestOrigin),
      grant_type: "authorization_code"
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    const parsed = tryParseOAuthError(detail);
    throw new Error(
      parsed ??
        `Google OAuth ?? ??? ??????. ????? URI? Google Cloud ??? ??? URI? ??? ????? ?????. (${detail})`
    );
  }

  return (await response.json()) as TokenResponse;
}

function tryParseOAuthError(text: string): string | null {
  try {
    const j = JSON.parse(text) as { error?: string; error_description?: string };
    if (j.error_description || j.error) {
      return `Google OAuth: ${j.error_description || j.error}`;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function textItem(title: string, description?: string) {
  return {
    title,
    description,
    textItem: {}
  };
}

function choiceItem(
  title: string,
  description: string,
  options: string[],
  type: "RADIO" | "CHECKBOX" = "RADIO"
) {
  return {
    title,
    description,
    questionItem: {
      question: {
        required: false,
        choiceQuestion: {
          type,
          options: options.map((value) => ({ value })),
          shuffle: false
        }
      }
    }
  };
}

function questionItem(title: string, description: string, responseType: ResponseType) {
  if (responseType === "text") {
    return {
      title,
      description,
      questionItem: {
        question: {
          required: false,
          textQuestion: {
            paragraph: true
          }
        }
      }
    };
  }

  if (responseType === "likert_3") {
    return choiceItem(title, description, LIKERT_3_OPTIONS, "RADIO");
  }
  if (responseType === "yes_no") {
    return choiceItem(title, description, YES_NO_OPTIONS, "RADIO");
  }
  if (responseType === "checklist") {
    return choiceItem(title, description, YES_NO_OPTIONS, "CHECKBOX");
  }
  return choiceItem(title, description, LIKERT_5_OPTIONS, "RADIO");
}

async function createGoogleFormForAudience(
  draft: SurveyDraft,
  audience: Audience,
  accessToken: string
): Promise<{
  formId: string;
  editUrl: string;
  responderUrl?: string;
}> {
  const items = draft.itemsByAudience[audience] ?? [];
  if (items.length === 0) {
    throw new Error(`${AUDIENCE_LABELS[audience]} ??? ?? Google Form? ?? ? ????.`);
  }

  const titleForAudience = `${draft.title} (${AUDIENCE_LABELS[audience]})`;
  const createResponse = await fetch(FORMS_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      info: {
        title: titleForAudience,
        documentTitle: `${titleForAudience}_${draft.schoolName}`
      }
    })
  });

  if (!createResponse.ok) {
    const detail = await createResponse.text();
    throw new Error(`Google Forms API? ?? ?? ? ????. ${detail}`);
  }

  const form = (await createResponse.json()) as GoogleFormResponse;
  const requests: unknown[] = [
    {
      createItem: {
        item: textItem(`${AUDIENCE_LABELS[audience]} ??`, draft.introByAudience[audience]),
        location: { index: 0 }
      }
    }
  ];

  for (const item of items.slice().sort((a, b) => a.order - b.order)) {
    requests.push({
      createItem: {
        item: questionItem(
          item.editedQuestion || item.originalQuestion,
          `${item.area} / ${item.subarea} / ${item.indicator}`,
          item.responseType
        ),
        location: { index: requests.length }
      }
    });
  }

  const updateResponse = await fetch(`${FORMS_API_URL}/${form.formId}:batchUpdate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ requests })
  });

  if (!updateResponse.ok) {
    const detail = await updateResponse.text();
    throw new Error(`Google Form ?? ??(batchUpdate)? ??????. ${detail}`);
  }

  let responderUrl = form.responderUri;
  if (!responderUrl) {
    const getRes = await fetch(`${FORMS_API_URL}/${form.formId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (getRes.ok) {
      const full = (await getRes.json()) as { responderUri?: string };
      responderUrl = full.responderUri;
    }
  }

  return {
    formId: form.formId,
    editUrl: `https://docs.google.com/forms/d/${form.formId}/edit`,
    responderUrl
  };
}

export async function createGoogleFormsByAudienceFromDraft(
  draft: SurveyDraft,
  accessToken: string
): Promise<Partial<Record<Audience, Omit<GoogleFormInfo, "createdAt">>>> {
  const nextForms: Partial<Record<Audience, Omit<GoogleFormInfo, "createdAt">>> = {};
  for (const audience of AUDIENCES) {
    const items = draft.itemsByAudience[audience] ?? [];
    if (items.length === 0) {
      continue;
    }
    nextForms[audience] = await createGoogleFormForAudience(draft, audience, accessToken);
  }
  if (Object.keys(nextForms).length === 0) {
    throw new Error("??? ??? ?? Google Forms? ??? ? ????.");
  }
  return nextForms;
}
