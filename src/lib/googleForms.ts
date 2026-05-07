import { encodeSignedToken, decodeSignedToken } from "./session";
import { AUDIENCES, AUDIENCE_LABELS, LIKERT_5_OPTIONS, type SurveyDraft } from "./types";

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
    throw new Error(
      "OAuth ????? URI? ?? ? ????. ????? GOOGLE_REDIRECT_URI? ??? ?? ??? ?? ???? ????."
    );
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

function questionItem(title: string, description: string, responseType: string) {
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

  return {
    title,
    description,
    questionItem: {
      question: {
        required: false,
        choiceQuestion: {
          type: "RADIO",
          options: LIKERT_5_OPTIONS.map((value) => ({ value })),
          shuffle: false
        }
      }
    }
  };
}

export async function createGoogleFormFromDraft(
  draft: SurveyDraft,
  accessToken: string
): Promise<{
  formId: string;
  editUrl: string;
  responderUrl?: string;
}> {
  const createResponse = await fetch(FORMS_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      info: {
        title: draft.title,
        documentTitle: `${draft.title}_${draft.schoolName}`
      }
    })
  });

  if (!createResponse.ok) {
    const detail = await createResponse.text();
    throw new Error(
      `Google Forms API? ?? ?? ? ????. Google Cloud???Google Forms API?? ?? ???? ??? ?????. ${detail}`
    );
  }

  const form = (await createResponse.json()) as GoogleFormResponse;
  const requests: unknown[] = [];

  for (const audience of AUDIENCES) {
    const items = draft.itemsByAudience[audience] ?? [];
    if (items.length === 0) {
      continue;
    }

    requests.push({
      createItem: {
        item: textItem(`${AUDIENCE_LABELS[audience]} ??`, draft.introByAudience[audience]),
        location: { index: requests.length }
      }
    });

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
  }

  if (requests.length > 0) {
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
      throw new Error(`Google Form? ??? ???? batchUpdate? ??????. ${detail}`);
    }
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
