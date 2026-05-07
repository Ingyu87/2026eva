import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, initializeFirestore, type Firestore } from "firebase-admin/firestore";

function getServiceAccount():
  | {
      projectId: string;
      clientEmail: string;
      privateKey: string;
    }
  | null {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson) as {
        project_id?: string;
        client_email?: string;
        private_key?: string;
      };
      if (parsed.project_id && parsed.client_email && parsed.private_key) {
        return {
          projectId: parsed.project_id,
          clientEmail: parsed.client_email,
          privateKey: parsed.private_key.replace(/\\n/g, "\n")
        };
      }
    } catch {
      return null;
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return { projectId, clientEmail, privateKey };
}

export function getFirebaseAdminApp(): App | null {
  const serviceAccount = getServiceAccount();
  if (!serviceAccount) {
    return null;
  }

  if (getApps().length > 0) {
    return getApps()[0];
  }

  return initializeApp({
    credential: cert(serviceAccount)
  });
}

let cachedDb: Firestore | null | undefined;

/**
 * 일부 네트워크/방화벽 환경에서 gRPC가 응답 없이 멈출 수 있어 REST 전송을 우선합니다.
 * @see https://firebase.google.com/docs/firestore/quickstart#node.js_1
 */
export function getFirebaseDb(): Firestore | null {
  const app = getFirebaseAdminApp();
  if (!app) {
    return null;
  }
  if (cachedDb !== undefined) {
    return cachedDb;
  }
  try {
    cachedDb = initializeFirestore(app, { preferRest: true });
  } catch {
    try {
      cachedDb = getFirestore(app);
    } catch {
      cachedDb = null;
    }
  }
  return cachedDb;
}
