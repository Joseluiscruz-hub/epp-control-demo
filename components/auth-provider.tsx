"use client";

import React, { useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, ensureFirebaseReady } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { usePathname } from 'next/navigation';
import { ShieldCheck, Fingerprint, Lock, ArrowRight, HardHat } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { canUseAdminProfile, isGlobalProfile, type UserProfile } from '@/lib/admin-profile';
import { AuthContext, useAuth as useAuthContext } from '@/components/auth-context';
import { normalizeUserProfile } from '@/lib/user-profile';

const ENABLE_OFFLINE_MODE = process.env.NEXT_PUBLIC_ENABLE_OFFLINE_MODE === 'true';
const OFFLINE_SESSION_KEY = 'assetguard.offline.adminSession';
const OFFLINE_ADMIN_USER = {
  uid: 'offline-admin',
  email: 'offline@assetguard.local',
  displayName: 'Admin Offline',
  photoURL: null,
} as User;

export { useAuthContext as useAuth };

async function resolveUserProfile(user: User) {
  const email = user.email?.toLowerCase() ?? '';

  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists()) {
      const profile = normalizeUserProfile(user.uid, email, snap.data());
      if (profile) return profile;
    }
  } catch (error) {
    console.warn('[Admin profile unavailable from Firestore, trying server profile]', error);
  }

  try {
    const token = await user.getIdToken();
    const response = await fetch('/api/auth/profile', {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (response.ok) {
      const result = await response.json() as { profile?: Record<string, unknown> };
      if (result.profile) {
        return normalizeUserProfile(user.uid, email, result.profile);
      }
    } else if (response.status !== 401 && response.status !== 403) {
      console.warn('[Admin profile server fallback failed]', response.status);
    }
  } catch (error) {
    console.warn('[Admin profile server fallback unavailable]', error);
  }

  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [isOfflineSession, setIsOfflineSession] = useState(false);

  const startOfflineSession = () => {
    if (!ENABLE_OFFLINE_MODE) {
      window.localStorage.removeItem(OFFLINE_SESSION_KEY);
      toast.error('El modo offline admin esta deshabilitado en este ambiente.');
      return;
    }

    const offlineProfile: UserProfile = {
      uid: OFFLINE_ADMIN_USER.uid,
      email: OFFLINE_ADMIN_USER.email ?? 'offline@assetguard.local',
      role: 'admin_global',
      plantaId: 'nacional',
      displayName: OFFLINE_ADMIN_USER.displayName ?? 'Admin Offline',
      active: true,
    };
    window.localStorage.setItem(OFFLINE_SESSION_KEY, 'true');
    setUser(OFFLINE_ADMIN_USER);
    setProfile(offlineProfile);
    setIsAdmin(true);
    setIsGlobalAdmin(true);
    setIsOfflineSession(true);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    let unavailableTimeout: number | undefined;

    if (!ENABLE_OFFLINE_MODE) {
      window.localStorage.removeItem(OFFLINE_SESSION_KEY);
    } else if (window.localStorage.getItem(OFFLINE_SESSION_KEY) === 'true') {
      if (navigator.onLine !== false) {
        window.localStorage.removeItem(OFFLINE_SESSION_KEY);
      } else {
        const timeout = window.setTimeout(() => {
          startOfflineSession();
        }, 0);
        return () => window.clearTimeout(timeout);
      }
    }

    const authTimeout = window.setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 5000);

    const initializeAuthListener = async () => {
      try {
        await ensureFirebaseReady();
        if (cancelled) return;

        unsubscribe = onAuthStateChanged(auth, (u) => {
          window.clearTimeout(authTimeout);
          void (async () => {
            if (cancelled) return;
            setIsOfflineSession(false);
            setUser(u);

            if (!u) {
              setProfile(null);
              setIsAdmin(false);
              setIsGlobalAdmin(false);
              setLoading(false);
              return;
            }

            const resolvedProfile = await resolveUserProfile(u);
            if (cancelled) return;
            setProfile(resolvedProfile);
            setIsAdmin(canUseAdminProfile(resolvedProfile));
            setIsGlobalAdmin(isGlobalProfile(resolvedProfile));
            setLoading(false);
          })();
        }, (error) => {
          window.clearTimeout(authTimeout);
          console.error('[Auth state error]', error);
          setUser(null);
          setProfile(null);
          setIsAdmin(false);
          setIsGlobalAdmin(false);
          setIsOfflineSession(false);
          setLoading(false);
        });
      } catch (error) {
        window.clearTimeout(authTimeout);
        console.warn('[Auth unavailable, offline mode can be used]', error);
        unavailableTimeout = window.setTimeout(() => {
          if (cancelled) return;
          setUser(null);
          setProfile(null);
          setIsAdmin(false);
          setIsGlobalAdmin(false);
          setIsOfflineSession(false);
          setLoading(false);
        }, 0);
      }
    };

    void initializeAuthListener();

    return () => {
      cancelled = true;
      window.clearTimeout(authTimeout);
      if (unavailableTimeout) window.clearTimeout(unavailableTimeout);
      unsubscribe?.();
    };
  }, []);


  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    window.localStorage.removeItem(OFFLINE_SESSION_KEY);
    setIsOfflineSession(false);
    try {
      await ensureFirebaseReady();
      await signInWithPopup(auth, provider);
    } catch (error) {
      if (ENABLE_OFFLINE_MODE && typeof navigator !== 'undefined' && navigator.onLine === false) {
        startOfflineSession();
        return;
      }
      throw error;
    }
  };

  const signInOffline = async () => {
    if (!ENABLE_OFFLINE_MODE) {
      toast.error('El modo offline admin esta deshabilitado en este ambiente.');
      return;
    }
    startOfflineSession();
  };

  const logOut = async () => {
    window.localStorage.removeItem(OFFLINE_SESSION_KEY);
    if (isOfflineSession || user?.uid === OFFLINE_ADMIN_USER.uid) {
      setUser(null);
      setProfile(null);
      setIsAdmin(false);
      setIsGlobalAdmin(false);
      setIsOfflineSession(false);
      return;
    }

    try {
      await ensureFirebaseReady();
      await signOut(auth);
    } catch (error) {
      console.warn('[Sign out skipped because Firebase auth is unavailable]', error);
      setUser(null);
      setProfile(null);
      setIsAdmin(false);
      setIsGlobalAdmin(false);
      setIsOfflineSession(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, isGlobalAdmin, isOfflineSession, signIn, signInOffline, logOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, signIn, signInOffline, isAdmin, logOut } = useAuthContext();
  const pathname = usePathname();

  const handleOnlineSignIn = async () => {
    try {
      await signIn();
    } catch (error) {
      console.error('[Online sign in error]', error);
      const code =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof (error as { code?: unknown }).code === 'string'
          ? (error as { code: string }).code
          : '';

      if (code === 'auth/popup-blocked') {
        toast.error('El navegador bloqueó la ventana de Google. Permite popups para iniciar sesión.');
      } else if (code === 'auth/unauthorized-domain') {
        toast.error('Este dominio no está autorizado en Firebase Auth.');
      } else {
        toast.error('No se pudo iniciar sesión en modo online. Intenta de nuevo.');
      }
    }
  };

  // Permitir acceso total al portal público y kiosko
  if (pathname?.startsWith('/portal') || pathname?.startsWith('/kiosko')) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 gap-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="relative"
        >
          <div className="absolute inset-0 bg-primary rounded-3xl opacity-0 " />
          <div className="relative h-20 w-20 rounded-3xl bg-[var(--primary)] flex items-center justify-center">
            <ShieldCheck className="h-10 w-10 text-white" />
          </div>
        </motion.div>
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 bg-primary rounded-full  [animation-delay:0ms]" />
          <div className="h-2 w-2 bg-primary rounded-full  [animation-delay:150ms]" />
          <div className="h-2 w-2 bg-primary rounded-full  [animation-delay:300ms]" />
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ">Inicializando Sistemas de Seguridad</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6 relative overflow-hidden">
        {/* Executive background */}
        <div className="absolute inset-0 pointer-events-none">
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 w-full max-w-lg"
        >
          {/* Logo Section */}
          <div className="text-center mb-12">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
              className="inline-flex relative mb-6"
            >
              <div className="relative h-20 w-20 rounded-xl bg-[var(--primary)] flex items-center justify-center">
                <ShieldCheck className="h-12 w-12 text-white" />
              </div>
            </motion.div>
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase">AssetGuard</h1>
            <p className="text-primary font-medium tracking-[0.3em] uppercase text-[10px] mt-2">Seguridad industrial</p>
          </div>

          {/* Login Card */}
          <div className="enterprise-panel">
            {/* barra superior */}
            <div className="h-1 bg-primary" />
            
            <div className="p-10 text-center space-y-8">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg border border-white/10 bg-white/5">
                  <Lock className="h-3.5 w-3.5 text-white/45" />
                  <span className="section-eyebrow">Acceso Restringido</span>
                </div>
                <h2 className="text-3xl font-black text-white tracking-tight">Panel Administrativo</h2>
                <p className="text-white/50 font-medium leading-relaxed max-w-sm mx-auto">
                  Inicia sesión con tu cuenta corporativa para acceder a la gestión de inventario y personal.
                </p>
              </div>

              <Button 
                onClick={() => void handleOnlineSignIn()} 
                className="w-full h-16 rounded-lg bg-[var(--primary)] hover:bg-primary transition-all duration-300 text-white font-black uppercase tracking-widest text-xs gap-4 group active:scale-[0.98]"
              >
                <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                  <Fingerprint className="h-5 w-5" />
                </div>
                Continuar con Google
                <ArrowRight className="h-4 w-4 ml-auto opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </Button>
              {ENABLE_OFFLINE_MODE && (
                <Button
                  type="button"
                  onClick={signInOffline}
                  className="w-full h-14 rounded-lg border border-primary/25 bg-primary/10 hover:bg-primary/15 text-primary font-black uppercase tracking-widest text-xs gap-3"
                >
                  <HardHat className="h-4 w-4" />
                  Entrar en modo offline
                </Button>
              )}
              
              <div className="pt-6 border-t border-white/10 space-y-3">
                <p className="section-eyebrow">¿Eres colaborador?</p>
                <div className="flex flex-col gap-3">
                  <a
                    href="/portal"
                    className="inline-flex items-center justify-center gap-2 text-sm font-black text-[var(--primary)] hover:text-primary-strong transition-colors uppercase tracking-wider group"
                  >
                    Ir al Portal de Seguridad
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </a>
                  <a
                    href="/kiosko"
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-5 py-3 text-xs font-black text-white/70 hover:border-primary/40 hover:bg-primary/10 hover:text-primary transition-colors uppercase tracking-wider group"
                  >
                    <HardHat className="h-4 w-4" />
                    Solicitar EPP en Kiosko
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="relative z-10 mt-12 text-center space-y-4"
        >
          <div className="flex items-center justify-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary " />
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Sistemas Operativos</span>
          </div>
          {/* Insignia */}
          <div className="badge-brand inline-block">
            Plataforma corporativa
          </div>
          <p className="text-[9px] text-white/25 uppercase tracking-[0.4em]">AssetGuard v4.0 · Seguridad Industrial</p>
        </motion.div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="relative z-10 w-full max-w-lg enterprise-panel p-10 text-center space-y-8"
        >
          <div className="mx-auto h-16 w-16 rounded-xl bg-[var(--primary)]/20 border border-[var(--primary)]/30 flex items-center justify-center">
            <Lock className="h-8 w-8 text-[var(--primary)]" />
          </div>
          <div className="space-y-3">
            <p className="section-eyebrow">Acceso Administrativo</p>
            <h1 className="text-3xl font-black text-white tracking-tight">Cuenta no autorizada</h1>
            <p className="text-white/50 font-medium leading-relaxed">
              {user.email} no tiene un perfil administrativo activo en AssetGuard.
            </p>
          </div>
          <Button
            onClick={logOut}
            className="w-full h-14 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black uppercase tracking-widest text-xs"
          >
            Cambiar cuenta
          </Button>
        </motion.div>
      </div>
    );
  }

  return <>{children}</>;
}
