/**
 * ControlID Session Manager
 *
 * Handles login, token caching, and auto-retry on session expiry
 * for direct calls to remote_user_authorization.fcgi.
 */

interface SessionConfig {
  ip: string;
  port?: string;
  protocol?: string;
  user: string;
  password: string;
}

interface AuthorizePayload {
  userName: string;
  terminalType: 'door' | 'sec_box' | 'open_collector' | 'catra';
  portalId?: number;
  catراRotation?: 'L' | 'R' | string; // used only when terminalType === 'catra'
  secBoxId?: number;
}

let cachedSession: string | null = null;
let sessionObtainedAt = 0;
const SESSION_TTL_MS = 9 * 60 * 1000; // 9 minutes (device expires at ~10-15 min)

function buildBaseUrl(cfg: SessionConfig): string {
  const protocol = cfg.protocol || 'http';
  const port = cfg.port && cfg.port !== '80' && cfg.port !== '443' ? `:${cfg.port}` : '';
  return `${protocol}://${cfg.ip}${port}`;
}

async function fetchSession(cfg: SessionConfig): Promise<string> {
  const res = await fetch(`${buildBaseUrl(cfg)}/login.fcgi`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: cfg.user, password: cfg.password })
  });

  if (!res.ok) throw new Error(`Login failed: HTTP ${res.status}`);
  const data = await res.json();
  if (!data.session) throw new Error('Login response missing session token');
  return data.session as string;
}

async function getSession(cfg: SessionConfig): Promise<string> {
  const now = Date.now();
  if (cachedSession && (now - sessionObtainedAt) < SESSION_TTL_MS) {
    return cachedSession;
  }
  cachedSession = await fetchSession(cfg);
  sessionObtainedAt = Date.now();
  return cachedSession;
}

function invalidateSession() {
  cachedSession = null;
  sessionObtainedAt = 0;
}

function buildPayload(opts: AuthorizePayload) {
  const { userName, terminalType, portalId = 1, secBoxId, catراRotation } = opts;

  let action: string;
  let parameters: string;

  switch (terminalType) {
    case 'door':
      action = 'door';
      parameters = 'door=1';
      break;
    case 'sec_box':
      action = 'sec_box';
      parameters = secBoxId ? `id=${secBoxId},reason=3` : 'reason=3';
      break;
    case 'open_collector':
      action = 'open_collector';
      parameters = '';
      break;
    case 'catra': {
      action = 'catra';
      let allow = 'both';
      if (catراRotation === 'L') allow = 'anticlockwise';
      else if (catراRotation === 'R') allow = 'clockwise';
      parameters = `allow=${allow},reason=3`;
      break;
    }
    default:
      throw new Error(`Unknown terminal type: ${terminalType}`);
  }

  return {
    event: 7,
    user_id: 0,
    user_name: userName,
    user_image: false,
    portal_id: portalId,
    actions: [{ action, parameters }]
  };
}

/**
 * Sends a remote_user_authorization command to the ControlID device.
 * Automatically re-authenticates if the session has expired.
 */
export async function authorizeUser(
  cfg: SessionConfig,
  opts: AuthorizePayload
): Promise<{ success: boolean; message: string }> {
  const payload = buildPayload(opts);
  const baseUrl = buildBaseUrl(cfg);

  // First attempt
  try {
    const session = await getSession(cfg);
    const url = `${baseUrl}/remote_user_authorization.fcgi?session=${session}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) return { success: true, message: 'Access granted' };

    // Session expired → retry once
    if (res.status === 401 || res.status === 403) {
      invalidateSession();
      const newSession = await getSession(cfg);
      const retryUrl = `${baseUrl}/remote_user_authorization.fcgi?session=${newSession}`;
      const retryRes = await fetch(retryUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (retryRes.ok) return { success: true, message: 'Access granted (after re-auth)' };
      return { success: false, message: `Device rejected command: HTTP ${retryRes.status}` };
    }

    return { success: false, message: `Unexpected response: HTTP ${res.status}` };
  } catch (err) {
    invalidateSession(); // Safety: clear cache on network error
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Network error'
    };
  }
}

export { invalidateSession, type SessionConfig, type AuthorizePayload };
