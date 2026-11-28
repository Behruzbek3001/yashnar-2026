import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  ConfirmationResult,
  RecaptchaVerifier,
  createUserWithEmailAndPassword,
  isSignInWithEmailLink,
  sendEmailVerification,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { useQueryClient } from '@tanstack/react-query';
import { auth, firebaseReady, googleAuthProvider } from '../lib/firebase';
import { apiRequest, ApiError, setSessionToken } from '../lib/api';

export interface UserProfile {
  id: number;
  email: string;
  fullName: string;
  phone: string;
  role: 'citizen' | 'driver' | 'admin';
  accountStatus: 'active' | 'suspended';
  regionId: number | null;
  regionName: string | null;
  districtId: number | null;
  districtName: string | null;
  mfyId: number | null;
  mfyName: string | null;
  mfyStatus: string | null;
  publicLeaderboardName: string | null;
  leaderboardVisible: boolean;
  onboardingCompleted: boolean;
  themePreference: string;
  unreadNotifications: number;
  wallet: {
    coinBalance: number;
    totalXp: number;
    currentLevel: number;
    currentStreak: number;
    longestStreak: number;
  };
  driver: {
    id: number;
    approvalStatus: string;
    vehiclePlate: string;
    vehicleCapacityLiters: number;
  } | null;
}

export type AuthFlowResult =
  | { status: 'authenticated'; user: UserProfile }
  | { status: 'verification_required'; email: string };

interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  phone: string;
  districtId: number;
}

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  refreshUser: () => Promise<UserProfile | null>;
  loginWithEmail: (email: string, password: string) => Promise<AuthFlowResult>;
  registerWithEmail: (payload: RegisterPayload) => Promise<AuthFlowResult>;
  completeEmailVerification: (pendingProfile?: {
    fullName: string;
    phone: string;
    districtId: number;
  }) => Promise<UserProfile>;
  resendVerificationEmail: () => Promise<void>;
  sendEmailLoginLink: (email: string) => Promise<string>;
  completeEmailLoginLink: (email: string, linkUrl: string) => Promise<UserProfile>;
  isEmailLoginLinkUrl: (url: string) => boolean;
  sendPhoneSmsCode: (phone: string, recaptchaContainerId: string) => Promise<string>;
  verifyPhoneSmsCode: (
    code: string,
    profile?: { fullName?: string; districtId?: number }
  ) => Promise<UserProfile>;
  confirmOwnPhoneCode: (code: string) => Promise<void>;
  resetPhoneSmsSession: () => void;
  sendPasswordReset: (email: string) => Promise<string>;
  loginWithGoogle: () => Promise<UserProfile>;
  logout: () => Promise<void>;
  googleAvailable: boolean;
}

function mapFirebaseAuthError(err: unknown, fallback: string, providerHint?: string): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code)
      : '';

  switch (code) {
    case 'auth/email-already-in-use':
      return 'Ushbu elektron pochta allaqachon ro‘yxatdan o‘tgan. Kirish bo‘limidan foydalaning.';
    case 'auth/invalid-email':
      return 'Yaroqli elektron pochta manzilini kiriting.';
    case 'auth/weak-password':
      return 'Parol juda sodda. Kamida 12 ta belgidan iborat mustahkam parol kiriting.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Elektron pochta yoki parol noto‘g‘ri.';
    case 'auth/too-many-requests':
      return 'Juda ko‘p urinish amalga oshirildi. Biroz kutib qaytadan urinib ko‘ring.';
    case 'auth/operation-not-allowed':
      return providerHint
        ? `Firebase Console (yashnar2026) → Authentication → Sign-in method bo‘limida "${providerHint}" usulini yoqing. Hozircha Google yoki Parol orqali kirishingiz mumkin.`
        : 'Firebase Console (yashnar2026) → Authentication → Sign-in method bo‘limida ushbu kirish usulini yoqing.';
    case 'auth/billing-not-enabled':
      return 'Firebase SMS yuborish uchun Firebase Console → Authentication → Phone bo‘limida Blaze tarifini yoqing yoki sinov uchun Test Phone Numbers qo‘shing.';
    case 'auth/error-code:-39':
      return 'Firebase ushbu operator/hudud (+998) yoki raqamga SMS yuborishni vaqtincha chekladi (xato -39). Firebase Console → Authentication → Settings → SMS region policy bo‘limida O‘zbekiston ruxsat etilganini va Blaze tarifi faolligini tekshiring, sinov uchun "Phone numbers for testing" qo‘shing yoki Google / Email orqali kiring.';
    case 'auth/quota-exceeded':
      return 'SMS yuborish kunlik limiti tugadi. Birozdan so‘ng urinib ko‘ring yoki Google / Email orqali kiring.';
    case 'auth/invalid-phone-number':
      return 'Telefon raqami noto‘g‘ri. Masalan: +998901234567';
    case 'auth/invalid-verification-code':
      return 'SMS tasdiqlash kodi noto‘g‘ri. 6 xonali kodni qaytadan tekshiring.';
    case 'auth/code-expired':
      return 'SMS kodning amal qilish muddati tugadi. Yangi kod so‘rang.';
    case 'auth/captcha-check-failed':
    case 'auth/unauthorized-domain':
      return 'Domen yoki reCAPTCHA tekshiruvi o‘tmadi. Firebase Console → Authentication → Settings → Authorized domains bo‘limini tekshiring.';
    case 'auth/invalid-action-code':
    case 'auth/expired-action-code':
      return 'Kirish havolasi eskirgan yoki allaqachon ishlatilgan. Yangi havola so‘rang.';
    case 'auth/network-request-failed':
      return 'Internet aloqasi uzildi. Tarmoqni tekshirib qaytadan urinib ko‘ring.';
    default: {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('error-code:-39')) {
        return 'Firebase ushbu operator/hudud (+998) yoki raqamga SMS yuborishni vaqtincha chekladi (xato -39). Sinov uchun Firebase Console → Phone → Phone numbers for testing raqamidan foydalaning yoki Google / Email orqali kiring.';
      }
      return msg || fallback;
    }
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const phoneConfirmationRef = useRef<ConfirmationResult | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = window.localStorage.getItem('yashnar_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    window.localStorage.setItem('yashnar_theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      if (user) {
        apiRequest('/api/auth/profile', {
          method: 'PATCH',
          body: JSON.stringify({ themePreference: next }),
        }).catch(() => {});
      }
      return next;
    });
  }, [user]);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiRequest<{ user: UserProfile | null }>('/api/auth/me');
      setUser(data.user);
      if (data.user?.themePreference === 'dark' || data.user?.themePreference === 'light') {
        setTheme(data.user.themePreference);
      }
      return data.user;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Authenticated realtime invalidation WebSocket
  useEffect(() => {
    if (!user) return;
    let ws: WebSocket | null = null;
    let closedByCleanup = false;
    let reconnectTimer: number | null = null;

    const connect = () => {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${proto}//${window.location.host}/ws`);

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as { type?: string; keys?: string[] };
          if (msg.type === 'invalidate' && Array.isArray(msg.keys)) {
            for (const key of msg.keys) {
              queryClient.invalidateQueries({ queryKey: [key] });
            }
            if (msg.keys.includes('notifications')) {
              refreshUser();
            }
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (!closedByCleanup) {
          reconnectTimer = window.setTimeout(connect, 5000);
        }
      };
    };

    connect();
    return () => {
      closedByCleanup = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [user?.id, queryClient, refreshUser]);

  const loginWithEmail = useCallback(async (email: string, password: string): Promise<AuthFlowResult> => {
    // 1. Try local PostgreSQL session login first (supports seeded admin/driver and existing local users)
    try {
      const data = await apiRequest<{ user: UserProfile; sessionToken?: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (data.sessionToken) setSessionToken(data.sessionToken);
      setUser(data.user);
      return { status: 'authenticated', user: data.user };
    } catch (localErr) {
      // If account is suspended or server error (non-401), propagate immediately
      if (localErr instanceof ApiError && localErr.status !== 401) {
        throw localErr;
      }
      if (!firebaseReady || !auth) {
        throw localErr;
      }
    }

    // 2. Authenticate via Firebase Email/Password and enforce email verification
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (!cred.user.emailVerified) {
        // Automatically send a fresh verification link when an unverified user tries to sign in
        try {
          await sendEmailVerification(cred.user);
        } catch {
          // ignore cooldown error; user can also click Resend
        }
        return { status: 'verification_required', email: cred.user.email || email.trim() };
      }
      const idToken = await cred.user.getIdToken(true);
      const data = await apiRequest<{ user: UserProfile; sessionToken?: string }>('/api/auth/firebase-login', {
        method: 'POST',
        body: JSON.stringify({ idToken }),
      });
      if (data.sessionToken) setSessionToken(data.sessionToken);
      setUser(data.user);
      return { status: 'authenticated', user: data.user };
    } catch (fbErr) {
      const code =
        typeof fbErr === 'object' && fbErr !== null && 'code' in fbErr
          ? String((fbErr as { code?: unknown }).code)
          : '';
      if (code === 'auth/operation-not-allowed') {
        throw new Error('Elektron pochta yoki parol noto‘g‘ri.');
      }
      throw new Error(mapFirebaseAuthError(fbErr, 'Elektron pochta yoki parol noto‘g‘ri.', 'Email/Password'));
    }
  }, []);

  const registerWithEmail = useCallback(async (payload: RegisterPayload): Promise<AuthFlowResult> => {
    // Enforce real email verification via Firebase Auth when Email/Password is enabled
    if (firebaseReady && auth) {
      try {
        const cred = await createUserWithEmailAndPassword(auth, payload.email.trim(), payload.password);
        await sendEmailVerification(cred.user);
        return { status: 'verification_required', email: cred.user.email || payload.email.trim() };
      } catch (fbErr) {
        const code =
          typeof fbErr === 'object' && fbErr !== null && 'code' in fbErr
            ? String((fbErr as { code?: unknown }).code)
            : '';
        // If Firebase Email/Password provider isn't toggled on yet in Firebase Console, fall back cleanly to local registration
        if (code !== 'auth/operation-not-allowed') {
          throw new Error(mapFirebaseAuthError(fbErr, 'Ro‘yxatdan o‘tishda xatolik yuz berdi.', 'Email/Password'));
        }
      }
    }

    const data = await apiRequest<{ user: UserProfile; sessionToken?: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (data.sessionToken) setSessionToken(data.sessionToken);
    setUser(data.user);
    return { status: 'authenticated', user: data.user };
  }, []);

  const completeEmailVerification = useCallback(
    async (pendingProfile?: { fullName: string; phone: string; districtId: number }) => {
      if (!auth || !auth.currentUser) {
        throw new Error('Tasdiqlash sessiyasi topilmadi. Qaytadan kiring.');
      }
      await auth.currentUser.reload();
      if (!auth.currentUser.emailVerified) {
        throw new Error(
          'Elektron pochtangiz hali tasdiqlanmagan. Pochtangizga (yoki Spam papkasiga) yuborilgan havolani bosing.'
        );
      }

      const idToken = await auth.currentUser.getIdToken(true);
      const data = pendingProfile
        ? await apiRequest<{ user: UserProfile; sessionToken?: string }>('/api/auth/firebase-register', {
            method: 'POST',
            body: JSON.stringify({
              idToken,
              fullName: pendingProfile.fullName,
              phone: pendingProfile.phone,
              districtId: pendingProfile.districtId,
            }),
          })
        : await apiRequest<{ user: UserProfile; sessionToken?: string }>('/api/auth/firebase-login', {
            method: 'POST',
            body: JSON.stringify({ idToken }),
          });

      if (data.sessionToken) setSessionToken(data.sessionToken);
      setUser(data.user);
      return data.user;
    },
    []
  );

  const resendVerificationEmail = useCallback(async () => {
    if (!auth || !auth.currentUser) {
      throw new Error('Tasdiqlash sessiyasi topilmadi. Qaytadan urinib ko‘ring.');
    }
    try {
      await sendEmailVerification(auth.currentUser);
    } catch (err) {
      throw new Error(mapFirebaseAuthError(err, 'Tasdiqlash xatini yuborishda xatolik yuz berdi.'));
    }
  }, []);

  const sendEmailLoginLink = useCallback(async (email: string) => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Yaroqli elektron pochta manzilini kiriting.');
    }
    if (!firebaseReady || !auth) {
      throw new Error('Email tasdiqlash xizmati sozlanmagan.');
    }
    try {
      const actionCodeSettings = {
        url: `${window.location.origin}/login`,
        handleCodeInApp: true,
      };
      await sendSignInLinkToEmail(auth, cleanEmail, actionCodeSettings);
      try {
        window.localStorage.setItem('yashnar_email_for_signin', cleanEmail);
      } catch {
        // ignore storage errors inside restricted iframes
      }
      return `Tasdiqlash kirish havolasi ${cleanEmail} manziliga yuborildi. Pochtangizni (va Spam papkasini) ochib havolani bosing.`;
    } catch (err) {
      throw new Error(
        mapFirebaseAuthError(
          err,
          'Kirish tasdiqlash havolasini yuborishda xatolik yuz berdi.',
          'Email/Password → Email link (passwordless sign-in)'
        )
      );
    }
  }, []);

  const isEmailLoginLinkUrl = useCallback((url: string) => {
    if (!firebaseReady || !auth) return false;
    return isSignInWithEmailLink(auth, url);
  }, []);

  const completeEmailLoginLink = useCallback(async (email: string, linkUrl: string) => {
    if (!firebaseReady || !auth) {
      throw new Error('Email tasdiqlash xizmati sozlanmagan.');
    }
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Tasdiqlash uchun elektron pochta manzilingizni kiriting.');
    }
    try {
      const cred = await signInWithEmailLink(auth, cleanEmail, linkUrl);
      try {
        window.localStorage.removeItem('yashnar_email_for_signin');
      } catch {
        // ignore
      }
      const idToken = await cred.user.getIdToken(true);
      const data = await apiRequest<{ user: UserProfile; sessionToken?: string }>('/api/auth/firebase-login', {
        method: 'POST',
        body: JSON.stringify({ idToken }),
      });
      if (data.sessionToken) setSessionToken(data.sessionToken);
      setUser(data.user);
      return data.user;
    } catch (err) {
      throw new Error(mapFirebaseAuthError(err, 'Email havolasi orqali kirish tasdiqlanmadi.'));
    }
  }, []);

  const resetPhoneSmsSession = useCallback((recaptchaContainerId?: string) => {
    phoneConfirmationRef.current = null;
    if (recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current.clear();
      } catch {
        // ignore clear errors if container unmounted
      }
      recaptchaVerifierRef.current = null;
    }
    const hostId = recaptchaContainerId || 'yashnar-sms-recaptcha';
    const host = typeof document !== 'undefined' ? document.getElementById(hostId) : null;
    if (host) {
      host.replaceChildren();
    }
  }, []);

  const sendPhoneSmsCode = useCallback(
    async (rawPhone: string, recaptchaContainerId: string) => {
      const normalizedPhone = rawPhone.replace(/[\s()-]/g, '').trim();
      if (!/^\+998\d{9}$/.test(normalizedPhone)) {
        throw new Error('Telefon raqamini to‘g‘ri formatda kiriting. Masalan: +998901234567');
      }
      if (!firebaseReady || !auth) {
        throw new Error('SMS tasdiqlash xizmati hozircha sozlanmagan.');
      }

      // Clear any previous reCAPTCHA instance and create a brand-new DOM node
      // so Google grecaptcha never throws "reCAPTCHA has already been rendered in this element"
      resetPhoneSmsSession(recaptchaContainerId);
      const host = document.getElementById(recaptchaContainerId);
      if (!host) {
        throw new Error('reCAPTCHA konteyneri topilmadi. Sahifani yangilab qaytadan urinib ko‘ring.');
      }

      const freshMount = document.createElement('div');
      freshMount.id = `yashnar-recaptcha-slot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      host.appendChild(freshMount);

      try {
        const verifier = new RecaptchaVerifier(auth, freshMount, {
          size: 'invisible',
        });
        recaptchaVerifierRef.current = verifier;
        await verifier.render();
        const confirmation = await signInWithPhoneNumber(auth, normalizedPhone, verifier);
        phoneConfirmationRef.current = confirmation;
        return normalizedPhone;
      } catch (err) {
        resetPhoneSmsSession(recaptchaContainerId);
        throw new Error(
          mapFirebaseAuthError(err, 'SMS tasdiqlash kodini yuborishda xatolik yuz berdi.', 'Phone')
        );
      }
    },
    [resetPhoneSmsSession]
  );

  const verifyPhoneSmsCode = useCallback(
    async (rawCode: string, profile?: { fullName?: string; districtId?: number }) => {
      const cleanCode = rawCode.replace(/\D/g, '').trim();
      if (cleanCode.length !== 6) {
        throw new Error('6 xonali SMS tasdiqlash kodini kiriting.');
      }
      if (!phoneConfirmationRef.current) {
        throw new Error('SMS tasdiqlash sessiyasi topilmadi. Avval SMS kod yuboring.');
      }

      try {
        const cred = await phoneConfirmationRef.current.confirm(cleanCode);
        const idToken = await cred.user.getIdToken(true);
        const data = await apiRequest<{ user: UserProfile; sessionToken?: string }>('/api/auth/phone-login', {
          method: 'POST',
          body: JSON.stringify({
            idToken,
            ...(profile?.fullName?.trim() ? { fullName: profile.fullName.trim() } : {}),
            ...(profile?.districtId && profile.districtId > 0 ? { districtId: profile.districtId } : {}),
          }),
        });
        resetPhoneSmsSession();
        if (data.sessionToken) setSessionToken(data.sessionToken);
        setUser(data.user);
        return data.user;
      } catch (err) {
        throw new Error(mapFirebaseAuthError(err, 'SMS kod tasdiqlanmadi. Qaytadan urinib ko‘ring.'));
      }
    },
    [resetPhoneSmsSession]
  );

  /** Confirms the SMS code for the logged-in user's own phone (daily verification), without switching accounts. */
  const confirmOwnPhoneCode = useCallback(
    async (rawCode: string) => {
      const cleanCode = rawCode.replace(/\D/g, '').trim();
      if (cleanCode.length !== 6) throw new Error('6 xonali SMS kodni kiriting.');
      if (!phoneConfirmationRef.current) throw new Error('SMS sessiyasi topilmadi.');
      let idToken: string;
      try {
        const cred = await phoneConfirmationRef.current.confirm(cleanCode);
        idToken = await cred.user.getIdToken(true);
      } catch (err) {
        throw new Error(mapFirebaseAuthError(err, 'SMS kod noto‘g‘ri. Qaytadan kiriting.'));
      }
      await apiRequest('/api/phone-verification/confirm', { method: 'POST', body: JSON.stringify({ idToken }) });
      resetPhoneSmsSession();
      if (auth) await firebaseSignOut(auth).catch(() => {});
    },
    [resetPhoneSmsSession]
  );

  const sendPasswordReset = useCallback(async (email: string) => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Yaroqli elektron pochta manzilini kiriting.');
    }
    if (!firebaseReady || !auth) {
      const res = await apiRequest<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: cleanEmail }),
      });
      return res.message;
    }
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      return `Parolni tiklash havolasi ${cleanEmail} manziliga yuborildi. Elektron pochtangizni (va Spam papkasini) tekshiring.`;
    } catch (err) {
      throw new Error(mapFirebaseAuthError(err, 'Parolni tiklash havolasini yuborishda xatolik yuz berdi.'));
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    if (!firebaseReady || !auth) {
      throw new Error('Google orqali kirish sozlanmagan. Administrator bilan bog‘laning.');
    }
    const cred = await signInWithPopup(auth, googleAuthProvider);
    const idToken = await cred.user.getIdToken();
    const data = await apiRequest<{ user: UserProfile; sessionToken?: string }>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
    if (data.sessionToken) setSessionToken(data.sessionToken);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setSessionToken(null);
    resetPhoneSmsSession();
    if (auth) {
      try {
        await firebaseSignOut(auth);
      } catch {
        // ignore
      }
    }
    queryClient.clear();
    setUser(null);
  }, [queryClient, resetPhoneSmsSession]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        theme,
        toggleTheme,
        refreshUser,
        loginWithEmail,
        registerWithEmail,
        completeEmailVerification,
        resendVerificationEmail,
        sendEmailLoginLink,
        completeEmailLoginLink,
        isEmailLoginLinkUrl,
        sendPhoneSmsCode,
        verifyPhoneSmsCode,
        confirmOwnPhoneCode,
        resetPhoneSmsSession,
        sendPasswordReset,
        loginWithGoogle,
        logout,
        googleAvailable: firebaseReady,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
