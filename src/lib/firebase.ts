import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const BOOTSTRAPPED_ADMIN_EMAIL = 'diegolindolfo100@gmail.com';

export function isAdminUser(user: User | null): boolean {
  if (!user || !user.emailVerified || !user.email) return false;
  return user.email.trim().toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;
}

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
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
  path: string | null,
): never {
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
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function formatFriendlyFirestoreError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  if (raw.includes('Quota exceeded')) {
    return 'Cota diária gratuita do Firestore atingida. A cota é renovada automaticamente no dia seguinte.';
  }
  if (raw.includes('permission-denied') || raw.includes('Missing or insufficient permissions')) {
    return 'Permissão insuficiente no banco de dados. Entre com uma conta Google verificada para salvar ou remover áudios.';
  }
  if (raw.includes('the client is offline')) {
    return 'Banco de dados Firestore indisponível no momento (modo offline).';
  }
  return 'Não foi possível concluir a operação no banco de dados de pré-renderizados.';
}

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return false;
    }
    // Permission denied on /test/connection confirms live server reachability
    return true;
  }
}

void testConnection();
