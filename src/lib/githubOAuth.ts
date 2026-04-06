// GitHub OAuth Device Flow for Krypton IDE
// RFC 8628 — no client_secret needed, perfect for mobile apps
// User gets a code, enters it at github.com/login/device, and we poll for the token.

const GITHUB_CLIENT_ID = 'Ov23liyV98dAUjn7z7XO';
const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const VERIFY_URL = 'https://github.com/login/device';

// Scopes: repo (full repo access) + workflow (GitHub Actions)
const SCOPES = 'repo workflow';

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

export type PollStatus =
  | { status: 'pending' }
  | { status: 'complete'; token: string; scope: string }
  | { status: 'expired' }
  | { status: 'denied' }
  | { status: 'error'; message: string };

// ─── Step 1: Request Device Code ─────────────────────────────
export async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  const res = await fetch(DEVICE_CODE_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      scope: SCOPES,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to request device code: ${res.status} — ${text}`);
  }

  const data = await res.json();
  
  if (data.error) {
    throw new Error(`GitHub error: ${data.error_description || data.error}`);
  }

  return {
    device_code: data.device_code,
    user_code: data.user_code,
    verification_uri: data.verification_uri || VERIFY_URL,
    expires_in: data.expires_in || 900,
    interval: data.interval || 5,
  };
}

// ─── Step 2: Poll for Access Token ───────────────────────────
export async function pollForToken(deviceCode: string): Promise<PollStatus> {
  try {
    const res = await fetch(ACCESS_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });

    if (!res.ok) {
      return { status: 'error', message: `HTTP ${res.status}` };
    }

    const data = await res.json();

    // Check for error states
    if (data.error) {
      switch (data.error) {
        case 'authorization_pending':
          return { status: 'pending' };
        case 'slow_down':
          // GitHub wants us to slow down — will increase interval in caller
          return { status: 'pending' };
        case 'expired_token':
          return { status: 'expired' };
        case 'access_denied':
          return { status: 'denied' };
        default:
          return { status: 'error', message: data.error_description || data.error };
      }
    }

    // Success — we have the token
    if (data.access_token) {
      return {
        status: 'complete',
        token: data.access_token,
        scope: data.scope || '',
      };
    }

    return { status: 'error', message: 'Unexpected response from GitHub' };
  } catch (err: any) {
    return { status: 'error', message: err.message || 'Network error' };
  }
}

// ─── Step 3: Full Login Flow (combines 1 + 2) ───────────────
// Returns an abort controller so the UI can cancel polling
export interface DeviceFlowSession {
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  waitForToken: () => Promise<PollStatus>;
  cancel: () => void;
}

export async function startDeviceFlow(): Promise<DeviceFlowSession> {
  const codeResponse = await requestDeviceCode();
  let cancelled = false;
  let pollInterval = codeResponse.interval;

  const waitForToken = (): Promise<PollStatus> => {
    return new Promise((resolve) => {
      const poll = async () => {
        if (cancelled) {
          resolve({ status: 'denied' });
          return;
        }

        const result = await pollForToken(codeResponse.device_code);

        if (result.status === 'pending') {
          // Keep polling
          setTimeout(poll, pollInterval * 1000);
        } else {
          resolve(result);
        }
      };

      // Start first poll after the interval
      setTimeout(poll, pollInterval * 1000);
    });
  };

  return {
    userCode: codeResponse.user_code,
    verificationUri: codeResponse.verification_uri,
    expiresIn: codeResponse.expires_in,
    waitForToken,
    cancel: () => { cancelled = true; },
  };
}

// Utility: get verification URL
export { VERIFY_URL, GITHUB_CLIENT_ID };
