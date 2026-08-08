import { createContext, useContext, useState, useCallback } from "react";
import { clearSession, getStoredUser, getToken, setSession } from "./api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser);
  const [token, setToken] = useState(getToken);

  const login = useCallback((accessToken, userData) => {
    setSession(accessToken, userData);
    setToken(accessToken);
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((userData) => {
    setSession(getToken(), userData);
    setUser(userData);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
