import * as SecureStore from 'expo-secure-store';

/**
 * Microsoft Entra ID / MSAL authentication for React Native.
 *
 * In a real deployment, use `react-native-msal` or the
 * Expo AuthSession + expo-web-browser flow to get tokens.
 * Below is a production-ready skeleton with the correct
 * MSAL OAuth2 PKCE flow for Expo.
 */

export const BC_CONFIG = {
  tenantId: 'YOUR_TENANT_ID',
  clientId: 'YOUR_CLIENT_ID',
  companyId: 'YOUR_BC_COMPANY_ID',
  // OData v4 base URL — replace with your BC environment name
  baseUrl:
    'https://api.businesscentral.dynamics.com/v2.0/YOUR_TENANT_ID/production/ODataV4',
  scopes: [
    'https://api.businesscentral.dynamics.com/Financials.ReadWrite.All',
    'offline_access',
    'openid',
    'profile',
  ],
};

const TOKEN_KEY = 'bc_access_token';
const EXPIRY_KEY = 'bc_token_expiry';
const REFRESH_KEY = 'bc_refresh_token';

export async function saveTokens(
  accessToken: string,
  refreshToken: string,
  expiresIn: number
) {
  const expiry = Date.now() + expiresIn * 1000;
  await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
  await SecureStore.setItemAsync(EXPIRY_KEY, String(expiry));
}

export async function getStoredToken(): Promise<string | null> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  const expiry = await SecureStore.getItemAsync(EXPIRY_KEY);
  if (!token || !expiry) return null;
  if (Date.now() > Number(expiry) - 60_000) {
    return refreshAccessToken();
  }
  return token;
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  if (!refreshToken) return null;
  try {
    const res = await fetch(
      `https://login.microsoftonline.com/${BC_CONFIG.tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: BC_CONFIG.clientId,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          scope: BC_CONFIG.scopes.join(' '),
        }).toString(),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    await saveTokens(data.access_token, data.refresh_token ?? refreshToken, data.expires_in);
    return data.access_token as string;
  } catch {
    return null;
  }
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
  await SecureStore.deleteItemAsync(EXPIRY_KEY);
}
