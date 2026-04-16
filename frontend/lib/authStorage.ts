const TOKEN_KEY = "auth_token";

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

export const authStorage = {
  getToken(): string | null {
    if (!canUseStorage()) return null;
    return window.localStorage.getItem(TOKEN_KEY);
  },
  setToken(token: string) {
    if (!canUseStorage()) return;
    window.localStorage.setItem(TOKEN_KEY, token);
  },
  clearToken() {
    if (!canUseStorage()) return;
    window.localStorage.removeItem(TOKEN_KEY);
  },
};
