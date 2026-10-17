import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, doc, getDocFromServer } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

// Allow runtime environment variables (e.g. on Netlify or custom deployment)
// while keeping AI Studio provisioned config as the default
const cleanEnv = (val: unknown): string | undefined => {
  if (typeof val !== "string") return undefined;
  const trimmed = val.trim();
  if (!trimmed) return undefined;
  // Strip accidental quotes and trailing commas from copy-pasting JS objects
  return trimmed.replace(/^["']+|["',]+$/g, "").trim();
};

const envProjectId = cleanEnv(import.meta.env.VITE_FIREBASE_PROJECT_ID);
// If someone entered the database ID (ai-studio-...) as project ID, fall back to real project ID
const isInvalidProjectId = !envProjectId || envProjectId.startsWith("ai-studio-");

const envAuthDomain = cleanEnv(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN);
const isInvalidAuthDomain = !envAuthDomain || envAuthDomain.startsWith("ai-studio-");

const envAppId = cleanEnv(import.meta.env.VITE_FIREBASE_APP_ID);
const isInvalidAppId = !envAppId || envAppId.includes("717131421606");

const envSenderId = cleanEnv(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID);
const isInvalidSenderId = !envSenderId || envSenderId === "717131421606";

const envStorageBucket = cleanEnv(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET);
const isInvalidStorageBucket = !envStorageBucket || envStorageBucket.startsWith("ai-studio-");

const resolvedConfig = {
  apiKey: cleanEnv(import.meta.env.VITE_FIREBASE_API_KEY) || firebaseConfig.apiKey,
  authDomain: !isInvalidAuthDomain ? envAuthDomain : firebaseConfig.authDomain,
  projectId: !isInvalidProjectId ? envProjectId : firebaseConfig.projectId,
  storageBucket: !isInvalidStorageBucket ? envStorageBucket : firebaseConfig.storageBucket,
  messagingSenderId: !isInvalidSenderId ? envSenderId : firebaseConfig.messagingSenderId,
  appId: !isInvalidAppId ? envAppId : firebaseConfig.appId,
  firestoreDatabaseId:
    cleanEnv(import.meta.env.VITE_FIREBASE_DATABASE_ID) ||
    (envProjectId && envProjectId.startsWith("ai-studio-") ? envProjectId : undefined) ||
    firebaseConfig.firestoreDatabaseId,
};

const app = initializeApp(resolvedConfig);
export const db = resolvedConfig.firestoreDatabaseId
  ? getFirestore(app, resolvedConfig.firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// Validate connection to Firestore on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("the client is offline")
    ) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
