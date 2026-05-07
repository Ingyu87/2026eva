/**
 * Loads .env manually and tries one Firestore write. Run: node scripts/firebase-smoke-test.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");
const txt = readFileSync(envPath, "utf8");
for (const line of txt.split(/\r?\n/)) {
  if (!line || line.startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i < 0) continue;
  const k = line.slice(0, i);
  const v = line.slice(i + 1);
  if (!(k in process.env)) process.env[k] = v;
}

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("FAIL: missing FIREBASE_* env");
  process.exit(1);
}

const { initializeApp, cert, getApps } = await import("firebase-admin/app");
const { initializeFirestore } = await import("firebase-admin/firestore");

const app = getApps()[0] ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = initializeFirestore(app, { preferRest: true });

const t0 = Date.now();
await db.collection("_smoke").doc("ping").set({ at: new Date().toISOString() });
console.log("OK firestore write", Date.now() - t0, "ms");
