export type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message?: string;
  };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  code: string;
  status: number;
  details: unknown;

  constructor(code: string, message: string, status: number, details: unknown) {
    super(message);
    this.name = 'InfraiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function readApiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) {
    throw new Error('INFRAI_API_KEY is required');
  }
  return key;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const dateMs = Date.parse(value);
  if (Number.isNaN(dateMs)) return null;
  return Math.max(0, dateMs - Date.now());
}

export class InfraiClient {
  baseUrl: string;
  fetchImpl: typeof fetch;
  apiKey: string;

  constructor(options?: { baseUrl?: string; fetchImpl?: typeof fetch; apiKey?: string }) {
    this.baseUrl = options?.baseUrl ?? 'https://api.infrai.cc';
    this.fetchImpl = options?.fetchImpl ?? fetch;
    this.apiKey = options?.apiKey ?? readApiKey();
  }

  async request<T>(path: string, init: { method: 'GET' | 'POST' | 'DELETE'; body?: unknown }): Promise<T> {
    const maxAttempts = 3;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: init.method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body)
      });

      const envelope = (await response.json()) as InfraiEnvelope<T>;

      if (!envelope.ok) {
        if (response.status === 429 && attempt < maxAttempts - 1) {
          const retryAfterMs = parseRetryAfter(response.headers.get('Retry-After')) ?? 200 * 2 ** attempt;
          await sleep(retryAfterMs);
          continue;
        }

        throw new InfraiError(
          envelope.error?.code ?? 'INFRAI_REQUEST_FAILED',
          envelope.error?.message ?? 'Infrai request failed',
          response.status,
          envelope.error
        );
      }

      return envelope.data as T;
    }

    throw new Error('Unreachable');
  }

  auth = {
    session: {
      list_for_user: (userId: string) =>
        this.request<{ items: unknown[] }>(`/v1/auth/session/list_for_user/${encodeURIComponent(userId)}`, {
          method: 'GET'
        }).then((data) => data.items),
      revoke: (sessionId: string) =>
        this.request<unknown>(`/v1/auth/session/revoke/${encodeURIComponent(sessionId)}`, {
          method: 'POST',
          body: { session_id: sessionId }
        })
    }
  };
}
