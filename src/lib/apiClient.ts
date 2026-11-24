import { auth } from './firebase';

/**
 * Safely parses a fetch Response as JSON without throwing raw SyntaxError ("Unexpected token 'A'...")
 * when a serverless gateway (e.g. Vercel 500/502/504) returns a plain-text or HTML error page.
 */
export async function safeParseJson<T = Record<string, unknown>>(
  res: Response,
  fallbackErrorMessage = 'O servidor não respondeu como esperado. Tente novamente ou use os áudios pré-renderizados.',
): Promise<T> {
  const rawText = await res.text();
  if (!rawText || !rawText.trim()) {
    if (!res.ok) {
      throw new Error(fallbackErrorMessage);
    }
    return {} as T;
  }

  try {
    return JSON.parse(rawText) as T;
  } catch {
    if (rawText.includes('FUNCTION_INVOCATION_FAILED') || rawText.includes('A server error')) {
      throw new Error(
        'Serviço de geração em nuvem indisponível ou sem chave GEMINI_API_KEY configurada na Vercel. Usando áudio pré-renderizado ou voz local do dispositivo.',
      );
    }
    throw new Error(fallbackErrorMessage);
  }
}

/**
 * Performs a fetch request attaching the signed-in Firebase ID token as a Bearer token
 * whenever a user session is active.
 */
export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  const currentUser = auth.currentUser;
  if (currentUser) {
    try {
      const token = await currentUser.getIdToken();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    } catch {
      // Proceed without token; protected endpoints will return a clear 401 message
    }
  }
  return fetch(input, { ...init, headers });
}
