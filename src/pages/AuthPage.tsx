import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { MailCheck, RefreshCw } from 'lucide-react';
import { z } from 'zod';
import { useAuth } from '../contexts/AuthContext';
import { loginSchema, registerSchema } from '../lib/domain';
import { apiRequest } from '../lib/api';
import {
  Button,
  Dialog,
  ErrorAlert,
  FormField,
  Input,
  SearchableSelect,
  YashnarLogo,
  useToast,
} from '../components/ui/Primitives';

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

interface DistrictItem {
  id: number;
  name: string;
}

const GoogleIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
    <path
      fill="#4285F4"
      d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.08 3.56-5.15 3.56-8.65Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.29v3.1A12 12 0 0 0 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5.29 14.29A7.2 7.2 0 0 1 4.91 12c0-.79.14-1.56.38-2.29v-3.1H1.29A12 12 0 0 0 0 12c0 1.94.46 3.77 1.29 5.39l4-3.1Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.76c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.61l4 3.1c.94-2.84 3.59-4.95 6.71-4.95Z"
    />
  </svg>
);

const SimpleLeafIllustration: React.FC = () => (
  <svg
    viewBox="0 0 280 200"
    fill="none"
    aria-hidden="true"
    className="w-full max-w-[240px] mt-[32px] opacity-90"
  >
    <path
      d="M40 165C72 95 148 45 235 38C225 112 178 168 102 176C78 178 56 174 40 165Z"
      fill="rgba(52, 211, 153, 0.22)"
      stroke="#34D399"
      strokeWidth="2.5"
    />
    <path
      d="M35 170C95 124 152 84 222 46"
      stroke="#FFFFFF"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    <path
      d="M108 122C116 98 134 80 156 68"
      stroke="rgba(255,255,255,0.6)"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M140 100C160 106 178 112 194 114"
      stroke="rgba(255,255,255,0.6)"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export const AuthPage: React.FC<{ initialMode?: 'login' | 'register' }> = ({
  initialMode = 'login',
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [loginMethod, setLoginMethod] = useState<'password' | 'email_link' | 'phone_sms'>('password');
  const [registerMethod, setRegisterMethod] = useState<'email' | 'phone_sms'>('email');
  const [emailLinkAddress, setEmailLinkAddress] = useState('');
  const [emailLinkSentMsg, setEmailLinkSentMsg] = useState<string | null>(null);
  const [emailLinkLoading, setEmailLinkLoading] = useState(false);
  const [confirmLinkEmailOpen, setConfirmLinkEmailOpen] = useState(false);
  const [confirmLinkEmail, setConfirmLinkEmail] = useState('');

  // Phone SMS verification state
  const [smsPhone, setSmsPhone] = useState('+998');
  const [smsFullName, setSmsFullName] = useState('');
  const [smsDistrictId, setSmsDistrictId] = useState<number>(0);
  const [smsSentTo, setSmsSentTo] = useState<string | null>(null);
  const [smsCode, setSmsCode] = useState('');
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsCooldown, setSmsCooldown] = useState(0);

  const [serverError, setServerError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Email verification step state
  const [verificationPending, setVerificationPending] = useState<{
    email: string;
    profile?: { fullName: string; phone: string; districtId: number };
  } | null>(null);
  const [verifyingCheck, setVerifyingCheck] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);

  // Forgot password modal state
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotInfo, setForgotInfo] = useState<{ ok: boolean; text: string } | null>(null);

  const {
    loginWithEmail,
    registerWithEmail,
    completeEmailVerification,
    resendVerificationEmail,
    sendEmailLoginLink,
    completeEmailLoginLink,
    isEmailLoginLinkUrl,
    sendPhoneSmsCode,
    verifyPhoneSmsCode,
    resetPhoneSmsSession,
    sendPasswordReset,
    loginWithGoogle,
    googleAvailable,
  } = useAuth();
  const { toastSuccess } = useToast();
  const navigate = useNavigate();

  // Load all 14 Namangan viloyati districts for Sign Up
  const { data: districtsData } = useQuery({
    queryKey: ['public-districts'],
    queryFn: () => apiRequest<{ districts: DistrictItem[] }>('/api/geography/districts'),
  });

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (smsCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setSmsCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [smsCooldown]);

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      districtId: 0,
      password: '',
      passwordConfirmation: '',
      phone: '+998',
    },
  });

  const redirectUser = (u: { role: string; onboardingCompleted: boolean }) => {
    if (u.role === 'admin') return navigate('/admin', { replace: true });
    if (u.role === 'driver') return navigate('/driver', { replace: true });
    if (!u.onboardingCompleted) return navigate('/onboarding', { replace: true });
    return navigate('/citizen', { replace: true });
  };

  // Detect and complete Firebase Email Verification Sign-In Link when user returns from inbox
  useEffect(() => {
    const href = window.location.href;
    if (!isEmailLoginLinkUrl(href)) return;

    let savedEmail = '';
    try {
      savedEmail = window.localStorage.getItem('yashnar_email_for_signin') || '';
    } catch {
      savedEmail = '';
    }

    if (!savedEmail) {
      setConfirmLinkEmailOpen(true);
      return;
    }

    setEmailLinkLoading(true);
    completeEmailLoginLink(savedEmail, href)
      .then((u) => {
        window.history.replaceState({}, document.title, '/login');
        toastSuccess('Elektron pochta tasdiqlandi! Tizimga kirdingiz.');
        redirectUser(u);
      })
      .catch((err) => {
        setServerError(err instanceof Error ? err.message : 'Email havolasi tasdiqlanmadi.');
      })
      .finally(() => {
        setEmailLinkLoading(false);
      });
  }, [isEmailLoginLinkUrl, completeEmailLoginLink]);

  const handleSendEmailLoginLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setEmailLinkSentMsg(null);
    setEmailLinkLoading(true);
    try {
      const msg = await sendEmailLoginLink(emailLinkAddress);
      setEmailLinkSentMsg(msg);
      toastSuccess('Kirish tasdiqlash havolasi yuborildi!');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Havola yuborilmadi.');
    } finally {
      setEmailLinkLoading(false);
    }
  };

  const handleConfirmLinkEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setEmailLinkLoading(true);
    try {
      const u = await completeEmailLoginLink(confirmLinkEmail, window.location.href);
      setConfirmLinkEmailOpen(false);
      window.history.replaceState({}, document.title, '/login');
      toastSuccess('Elektron pochta tasdiqlandi! Tizimga kirdingiz.');
      redirectUser(u);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Tasdiqlash xatoligi.');
    } finally {
      setEmailLinkLoading(false);
    }
  };

  const handleSendSmsCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (smsLoading) return;
    setServerError(null);
    if (mode === 'register' && smsFullName.trim().length < 2) {
      setServerError('To‘liq ismingizni kiriting.');
      return;
    }
    if (mode === 'register' && smsDistrictId <= 0) {
      setServerError('Tumanni tanlang.');
      return;
    }
    setSmsLoading(true);
    try {
      const normalized = await sendPhoneSmsCode(smsPhone, 'yashnar-sms-recaptcha');
      setSmsSentTo(normalized);
      setSmsCode('');
      setSmsCooldown(60);
      toastSuccess(`${normalized} raqamiga 6 xonali SMS kod yuborildi.`);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'SMS kod yuborilmadi.');
    } finally {
      setSmsLoading(false);
    }
  };

  const handleVerifySmsCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setSmsLoading(true);
    try {
      const u = await verifyPhoneSmsCode(
        smsCode,
        mode === 'register'
          ? { fullName: smsFullName.trim(), districtId: smsDistrictId }
          : undefined
      );
      toastSuccess('Telefon raqami SMS orqali tasdiqlandi!');
      redirectUser(u);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'SMS kod tasdiqlanmadi.');
    } finally {
      setSmsLoading(false);
    }
  };

  const onLoginSubmit = async (values: LoginFormValues) => {
    setServerError(null);
    try {
      const result = await loginWithEmail(values.email, values.password);
      if (result.status === 'verification_required') {
        setVerificationPending({ email: result.email });
        setResendCooldown(60);
        toastSuccess('Elektron pochtangizga yangi tasdiqlash havolasi yuborildi.');
        return;
      }
      redirectUser(result.user);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Kirishda xatolik yuz berdi.');
    }
  };

  const onRegisterSubmit = async (values: RegisterFormValues) => {
    setServerError(null);
    try {
      const result = await registerWithEmail(values);
      if (result.status === 'verification_required') {
        setVerificationPending({
          email: result.email,
          profile: {
            fullName: values.fullName,
            phone: values.phone,
            districtId: values.districtId,
          },
        });
        setResendCooldown(60);
        toastSuccess('Tasdiqlash havolasi elektron pochtangizga yuborildi!');
        return;
      }
      toastSuccess('Hisobingiz muvaffaqiyatli yaratildi!');
      redirectUser(result.user);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Ro‘yxatdan o‘tishda xatolik yuz berdi.');
    }
  };

  const handleCheckVerification = async () => {
    if (!verificationPending) return;
    setServerError(null);
    setVerifyingCheck(true);
    try {
      const u = await completeEmailVerification(verificationPending.profile);
      toastSuccess('Elektron pochtangiz tasdiqlandi! Xush kelibsiz.');
      setVerificationPending(null);
      redirectUser(u);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Tasdiqlash tekshirilmadi.');
    } finally {
      setVerifyingCheck(false);
    }
  };

  const handleResendVerification = async () => {
    setServerError(null);
    setResending(true);
    try {
      await resendVerificationEmail();
      setResendCooldown(60);
      toastSuccess('Tasdiqlash havolasi qayta yuborildi.');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Havolani qayta yuborishda xatolik.');
    } finally {
      setResending(false);
    }
  };

  const handleGoogleClick = async () => {
    setServerError(null);
    if (!googleAvailable) {
      setServerError(
        'Google autentifikatsiyasi hozircha sozlanmagan. Iltimos, email orqali kiring yoki administratorga murojaat qiling.'
      );
      return;
    }
    setGoogleLoading(true);
    try {
      const u = await loginWithGoogle();
      redirectUser(u);
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'Google orqali kirishda xatolik yuz berdi.'
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotInfo(null);
    setForgotLoading(true);
    try {
      const msg = await sendPasswordReset(forgotEmail);
      setForgotInfo({ ok: true, text: msg });
    } catch (err) {
      setForgotInfo({
        ok: false,
        text: err instanceof Error ? err.message : 'Parolni tiklashda xatolik yuz berdi.',
      });
    } finally {
      setForgotLoading(false);
    }
  };

  const districtOptions = (districtsData?.districts ?? []).map((d) => ({
    value: d.id,
    label: d.name,
  }));

  return (
    <div className="min-h-[100dvh] bg-[#F8FAFC] dark:bg-[#0B1512] flex items-center justify-center p-[16px] md:p-[24px]">
      <div
        className="w-full max-w-[480px] lg:max-w-[960px] lg:min-h-[640px] rounded-[20px] border border-[#E2E8F0] dark:border-[#294237] bg-white dark:bg-[#13231D] overflow-hidden grid grid-cols-1 lg:grid-cols-[40%_60%]"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        {/* LEFT BRAND COLUMN (Hidden on mobile <1024px) */}
        <div className="hidden lg:flex flex-col justify-between bg-[#064E3B] text-white p-[40px]">
          <div>
            <div className="flex items-center gap-[12px]">
              <YashnarLogo size={40} inverted />
              <span className="text-[22px] font-extrabold tracking-tight text-white">YASHNAR</span>
            </div>

            <h1 className="mt-[40px] text-[28px] leading-[36px] font-bold text-white">
              Toza mahalla — yashil kelajak!
            </h1>
            <p className="mt-[12px] text-[14px] leading-[22px] text-emerald-100">
              Mahallangizda chiqindini o‘z vaqtida topshiring, haydovchi harakatini kuzating va
              ekologik faolligingiz uchun Eco Ballar jamg‘aring.
            </p>
          </div>

          <SimpleLeafIllustration />
        </div>

        {/* RIGHT FORM COLUMN */}
        <div className="p-[24px] lg:p-[48px] flex flex-col justify-center bg-white dark:bg-[#13231D]">
          <div className="w-full max-w-[384px] mx-auto">
            {/* Mobile Brand Header */}
            <div className="flex lg:hidden items-center gap-[10px] mb-[24px]">
              <YashnarLogo size={36} />
              <span className="text-[22px] font-extrabold text-[#065F46] dark:text-[#34D399]">
                YASHNAR
              </span>
            </div>

            {verificationPending ? (
              <div className="space-y-[20px]">
                <div className="w-[56px] h-[56px] rounded-[14px] bg-[#D1FAE5] dark:bg-[#065F46]/40 text-[#065F46] dark:text-[#34D399] flex items-center justify-center">
                  <MailCheck className="w-7 h-7" aria-hidden="true" />
                </div>

                <div>
                  <h2 className="text-[24px] leading-[32px] font-bold text-[#0F172A] dark:text-[#F1F5F9]">
                    Elektron pochtani tasdiqlang
                  </h2>
                  <p className="mt-[10px] text-[14px] leading-[22px] text-[#64748B] dark:text-[#A7B8AE]">
                    Biz{' '}
                    <span className="font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                      {verificationPending.email}
                    </span>{' '}
                    manziliga tasdiqlash havolasini yubordik. Pochtangizni (va Spam papkasini) ochib
                    havolani bosing, so‘ng pastdagi tugmani bosing.
                  </p>
                </div>

                {serverError && <ErrorAlert message={serverError} />}

                <Button
                  type="button"
                  className="w-full"
                  loading={verifyingCheck}
                  loadingLabel="Tekshirilmoqda..."
                  onClick={handleCheckVerification}
                >
                  Tasdiqladim, davom etish
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  disabled={resendCooldown > 0 || resending}
                  loading={resending}
                  loadingLabel="Yuborilmoqda..."
                  onClick={handleResendVerification}
                >
                  <RefreshCw className="w-4 h-4" aria-hidden="true" />
                  <span>
                    {resendCooldown > 0
                      ? `Qayta yuborish (${resendCooldown}s)`
                      : 'Havolani qayta yuborish'}
                  </span>
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setVerificationPending(null);
                      setServerError(null);
                    }}
                    className="text-[13px] font-medium text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#F1F5F9] cursor-pointer"
                  >
                    Boshqa email bilan urinib ko‘rish
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-[24px] leading-[32px] lg:text-[30px] lg:leading-[38px] font-bold text-[#0F172A] dark:text-[#F1F5F9]">
                  {mode === 'login' ? 'Hisobingizga kiring' : 'Ro‘yxatdan o‘tish'}
                </h2>
                <p className="mt-[12px] text-[14px] leading-[22px] text-[#64748B] dark:text-[#A7B8AE]">
                  {mode === 'login'
                    ? 'Davom etish uchun hisob ma’lumotlaringizni kiriting.'
                    : 'Fuqaro sifatida yangi YASHNAR hisobini yarating. Elektron pochtangizga tasdiqlash havolasi yuboriladi.'}
                </p>

                <div className="mt-[28px]">
                  {serverError && <ErrorAlert message={serverError} className="mb-[20px]" />}

                  {/* Google OAuth Button */}
                  <button
                    type="button"
                    onClick={handleGoogleClick}
                    disabled={googleLoading}
                    className="w-full h-[48px] px-[16px] rounded-[10px] bg-white dark:bg-[#0F1D17] border border-[#CBD5E1] dark:border-[#294237] text-[#0F172A] dark:text-[#F1F5F9] text-[14px] font-semibold flex items-center justify-center gap-[12px] hover:bg-[#F8FAFC] dark:hover:bg-[#1A2F27] transition-colors duration-150 cursor-pointer disabled:opacity-60"
                  >
                    <GoogleIcon />
                    <span>
                      {googleLoading ? 'Google bilan ulanmoqda...' : 'Google bilan davom etish'}
                    </span>
                  </button>

                  {/* Divider */}
                  <div className="my-[24px] flex items-center gap-[12px]">
                    <div className="h-[1px] flex-1 bg-[#E2E8F0] dark:bg-[#294237]" />
                    <span className="text-[12px] leading-[18px] text-[#64748B] dark:text-[#A7B8AE]">
                      yoki email / SMS orqali
                    </span>
                    <div className="h-[1px] flex-1 bg-[#E2E8F0] dark:bg-[#294237]" />
                  </div>

                  {mode === 'login' ? (
                    <div className="space-y-[20px]">
                      {/* Toggle between Password, Email Link Verification, and Phone SMS Verification */}
                      <div className="grid grid-cols-3 gap-[6px] p-[4px] rounded-[10px] bg-[#F1F5F9] dark:bg-[#0F1D17] border border-[#E2E8F0] dark:border-[#294237]">
                        <button
                          type="button"
                          aria-pressed={loginMethod === 'password'}
                          onClick={() => {
                            setLoginMethod('password');
                            setServerError(null);
                          }}
                          className={`min-h-[38px] px-[8px] rounded-[8px] text-[12px] font-semibold cursor-pointer ${
                            loginMethod === 'password'
                              ? 'bg-white dark:bg-[#13231D] text-[#065F46] dark:text-[#34D399] shadow-xs'
                              : 'text-[#64748B] dark:text-[#A7B8AE] hover:text-[#0F172A] dark:hover:text-[#F1F5F9]'
                          }`}
                        >
                          Parol
                        </button>
                        <button
                          type="button"
                          aria-pressed={loginMethod === 'email_link'}
                          onClick={() => {
                            setLoginMethod('email_link');
                            setServerError(null);
                            setEmailLinkSentMsg(null);
                          }}
                          className={`min-h-[38px] px-[8px] rounded-[8px] text-[12px] font-semibold cursor-pointer ${
                            loginMethod === 'email_link'
                              ? 'bg-white dark:bg-[#13231D] text-[#065F46] dark:text-[#34D399] shadow-xs'
                              : 'text-[#64748B] dark:text-[#A7B8AE] hover:text-[#0F172A] dark:hover:text-[#F1F5F9]'
                          }`}
                        >
                          Email
                        </button>
                        <button
                          type="button"
                          aria-pressed={loginMethod === 'phone_sms'}
                          onClick={() => {
                            setLoginMethod('phone_sms');
                            setServerError(null);
                          }}
                          className={`min-h-[38px] px-[8px] rounded-[8px] text-[12px] font-semibold cursor-pointer ${
                            loginMethod === 'phone_sms'
                              ? 'bg-white dark:bg-[#13231D] text-[#065F46] dark:text-[#34D399] shadow-xs'
                              : 'text-[#64748B] dark:text-[#A7B8AE] hover:text-[#0F172A] dark:hover:text-[#F1F5F9]'
                          }`}
                        >
                          SMS kod
                        </button>
                      </div>

                      {loginMethod === 'password' ? (
                        <form
                          key="login-password-form"
                          onSubmit={loginForm.handleSubmit(onLoginSubmit)}
                          className="space-y-[20px]"
                          noValidate
                        >
                          <FormField
                            label="Elektron pochta"
                            htmlFor="login-email"
                            required
                            error={loginForm.formState.errors.email?.message}
                          >
                            <Input
                              id="login-email"
                              type="email"
                              autoComplete="email"
                              placeholder="ism@example.com"
                              {...loginForm.register('email')}
                            />
                          </FormField>

                          <div>
                            <FormField
                              label="Parol"
                              htmlFor="login-password"
                              required
                              error={loginForm.formState.errors.password?.message}
                            >
                              <Input
                                id="login-password"
                                type="password"
                                autoComplete="current-password"
                                placeholder="Parolingizni kiriting"
                                {...loginForm.register('password')}
                              />
                            </FormField>
                            <div className="mt-[8px] text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setForgotEmail(loginForm.getValues('email') || '');
                                  setForgotInfo(null);
                                  setForgotOpen(true);
                                }}
                                className="text-[12px] leading-[18px] font-medium text-[#047857] dark:text-[#34D399] hover:underline cursor-pointer"
                              >
                                Parolni unutdingizmi?
                              </button>
                            </div>
                          </div>

                          <Button
                            type="submit"
                            className="w-full"
                            loading={loginForm.formState.isSubmitting}
                            loadingLabel="Kirilmoqda..."
                          >
                            Kirish
                          </Button>
                        </form>
                      ) : loginMethod === 'email_link' ? (
                        <form
                          key="login-email-link-form"
                          onSubmit={handleSendEmailLoginLink}
                          className="space-y-[18px]"
                          noValidate
                        >
                          <FormField
                            label="Elektron pochta"
                            htmlFor="login-link-email"
                            required
                            helper="Pochtangizga bir martalik tasdiqlangan kirish havolasi yuboriladi."
                          >
                            <Input
                              id="login-link-email"
                              type="email"
                              autoComplete="email"
                              required
                              value={emailLinkAddress}
                              onChange={(e) => setEmailLinkAddress(e.target.value)}
                              placeholder="ism@example.com"
                            />
                          </FormField>

                          {emailLinkSentMsg && (
                            <div className="p-[12px] rounded-[10px] bg-[#D1FAE5] text-[#065F46] dark:bg-[#065F46]/40 dark:text-[#34D399] text-[13px] leading-[20px]">
                              {emailLinkSentMsg}
                            </div>
                          )}

                          <Button
                            type="submit"
                            className="w-full"
                            loading={emailLinkLoading}
                            loadingLabel="Havola yuborilmoqda..."
                          >
                            Tasdiqlash havolasini yuborish
                          </Button>
                        </form>
                      ) : !smsSentTo ? (
                        <form
                          key="login-sms-phone-form"
                          onSubmit={handleSendSmsCode}
                          className="space-y-[18px]"
                          noValidate
                        >
                          <FormField
                            label="Telefon raqami"
                            htmlFor="login-sms-phone"
                            required
                            helper="Raqamingizga 6 xonali SMS tasdiqlash kodi yuboriladi (+998901234567)."
                          >
                            <Input
                              id="login-sms-phone"
                              type="tel"
                              autoComplete="tel"
                              required
                              value={smsPhone}
                              onChange={(e) => setSmsPhone(e.target.value)}
                              placeholder="+998901234567"
                            />
                          </FormField>

                          <Button
                            type="submit"
                            className="w-full"
                            loading={smsLoading}
                            loadingLabel="SMS kod yuborilmoqda..."
                          >
                            SMS kod yuborish
                          </Button>
                        </form>
                      ) : (
                        <form
                          key="login-sms-code-form"
                          onSubmit={handleVerifySmsCode}
                          className="space-y-[16px]"
                          noValidate
                        >
                          <div className="p-[12px] rounded-[10px] bg-[#D1FAE5] text-[#065F46] dark:bg-[#065F46]/40 dark:text-[#34D399] text-[13px] leading-[20px]">
                            <strong>{smsSentTo}</strong> raqamiga 6 xonali SMS tasdiqlash kodi yuborildi.
                          </div>

                          <FormField
                            label="SMS tasdiqlash kodi"
                            htmlFor="login-sms-code"
                            required
                            helper="SMS orqali kelgan 6 xonali raqamni kiriting."
                          >
                            <Input
                              id="login-sms-code"
                              type="text"
                              inputMode="numeric"
                              autoComplete="one-time-code"
                              maxLength={6}
                              required
                              value={smsCode}
                              onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              placeholder="123456"
                            />
                          </FormField>

                          <Button
                            type="submit"
                            className="w-full"
                            loading={smsLoading}
                            loadingLabel="Tasdiqlanmoqda..."
                          >
                            SMS kodni tasdiqlash va kirish
                          </Button>

                          <div className="flex items-center justify-between gap-[12px] text-[12px]">
                            <button
                              type="button"
                              disabled={smsCooldown > 0 || smsLoading}
                              onClick={handleSendSmsCode}
                              className="font-medium text-[#047857] dark:text-[#34D399] hover:underline disabled:opacity-50 cursor-pointer"
                            >
                              {smsCooldown > 0
                                ? `Qayta yuborish (${smsCooldown}s)`
                                : 'SMS kodni qayta yuborish'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                resetPhoneSmsSession();
                                setSmsSentTo(null);
                                setSmsCode('');
                                setServerError(null);
                              }}
                              className="font-medium text-[#64748B] dark:text-[#A7B8AE] hover:underline cursor-pointer"
                            >
                              Raqamni o‘zgartirish
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-[20px]">
                      <div className="grid grid-cols-2 gap-[6px] p-[4px] rounded-[10px] bg-[#F1F5F9] dark:bg-[#0F1D17] border border-[#E2E8F0] dark:border-[#294237]">
                        <button
                          type="button"
                          aria-pressed={registerMethod === 'email'}
                          onClick={() => {
                            setRegisterMethod('email');
                            setServerError(null);
                          }}
                          className={`min-h-[38px] px-[10px] rounded-[8px] text-[12px] font-semibold cursor-pointer ${
                            registerMethod === 'email'
                              ? 'bg-white dark:bg-[#13231D] text-[#065F46] dark:text-[#34D399] shadow-xs'
                              : 'text-[#64748B] dark:text-[#A7B8AE] hover:text-[#0F172A] dark:hover:text-[#F1F5F9]'
                          }`}
                        >
                          Email orqali
                        </button>
                        <button
                          type="button"
                          aria-pressed={registerMethod === 'phone_sms'}
                          onClick={() => {
                            setRegisterMethod('phone_sms');
                            setServerError(null);
                          }}
                          className={`min-h-[38px] px-[10px] rounded-[8px] text-[12px] font-semibold cursor-pointer ${
                            registerMethod === 'phone_sms'
                              ? 'bg-white dark:bg-[#13231D] text-[#065F46] dark:text-[#34D399] shadow-xs'
                              : 'text-[#64748B] dark:text-[#A7B8AE] hover:text-[#0F172A] dark:hover:text-[#F1F5F9]'
                          }`}
                        >
                          Telefon (SMS) orqali
                        </button>
                      </div>

                      {registerMethod === 'phone_sms' ? (
                        !smsSentTo ? (
                          <form
                            key="register-sms-phone-form"
                            onSubmit={handleSendSmsCode}
                            className="space-y-[18px]"
                            noValidate
                          >
                            <FormField label="To‘liq ism" htmlFor="reg-sms-fullname" required>
                              <Input
                                id="reg-sms-fullname"
                                type="text"
                                autoComplete="name"
                                required
                                value={smsFullName}
                                onChange={(e) => setSmsFullName(e.target.value)}
                                placeholder="Masalan: Jasur Toshmatov"
                              />
                            </FormField>

                            <FormField
                              label="Telefon raqami"
                              htmlFor="reg-sms-phone"
                              required
                              helper="Format: +998 va 9 ta raqam (SMS kod yuboriladi)"
                            >
                              <Input
                                id="reg-sms-phone"
                                type="tel"
                                autoComplete="tel"
                                required
                                value={smsPhone}
                                onChange={(e) => setSmsPhone(e.target.value)}
                                placeholder="+998901234567"
                              />
                            </FormField>

                            <FormField
                              label="Tuman / shahar"
                              htmlFor="reg-sms-district"
                              required
                              helper="Namangan viloyatining 14 ta tuman va shahri"
                            >
                              <SearchableSelect
                                id="reg-sms-district"
                                placeholder="Tumanni tanlang"
                                searchPlaceholder="Tumanni qidiring..."
                                value={smsDistrictId > 0 ? smsDistrictId : null}
                                options={districtOptions}
                                onChange={(val) => setSmsDistrictId(Number(val))}
                              />
                            </FormField>

                            <Button
                              type="submit"
                              className="w-full"
                              loading={smsLoading}
                              loadingLabel="SMS kod yuborilmoqda..."
                            >
                              SMS tasdiqlash kodini yuborish
                            </Button>
                          </form>
                        ) : (
                          <form
                            key="register-sms-code-form"
                            onSubmit={handleVerifySmsCode}
                            className="space-y-[16px]"
                            noValidate
                          >
                            <div className="p-[12px] rounded-[10px] bg-[#D1FAE5] text-[#065F46] dark:bg-[#065F46]/40 dark:text-[#34D399] text-[13px] leading-[20px]">
                              <strong>{smsSentTo}</strong> raqamiga 6 xonali SMS tasdiqlash kodi yuborildi.
                            </div>

                            <FormField label="SMS tasdiqlash kodi" htmlFor="reg-sms-code" required>
                              <Input
                                id="reg-sms-code"
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                maxLength={6}
                                required
                                value={smsCode}
                                onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="123456"
                              />
                            </FormField>

                            <Button
                              type="submit"
                              className="w-full"
                              loading={smsLoading}
                              loadingLabel="Tasdiqlanmoqda..."
                            >
                              Tasdiqlash va hisob yaratish
                            </Button>

                            <div className="flex items-center justify-between gap-[12px] text-[12px]">
                              <button
                                type="button"
                                disabled={smsCooldown > 0 || smsLoading}
                                onClick={handleSendSmsCode}
                                className="font-medium text-[#047857] dark:text-[#34D399] hover:underline disabled:opacity-50 cursor-pointer"
                              >
                                {smsCooldown > 0
                                  ? `Qayta yuborish (${smsCooldown}s)`
                                  : 'SMS kodni qayta yuborish'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  resetPhoneSmsSession();
                                  setSmsSentTo(null);
                                  setSmsCode('');
                                  setServerError(null);
                                }}
                                className="font-medium text-[#64748B] dark:text-[#A7B8AE] hover:underline cursor-pointer"
                              >
                                Raqamni o‘zgartirish
                              </button>
                            </div>
                          </form>
                        )
                      ) : (
                        <form
                          key="register-email-form"
                          onSubmit={registerForm.handleSubmit(onRegisterSubmit)}
                          className="space-y-[18px]"
                          noValidate
                        >
                      <FormField
                        label="To‘liq ism"
                        htmlFor="reg-fullname"
                        required
                        error={registerForm.formState.errors.fullName?.message}
                      >
                        <Input
                          id="reg-fullname"
                          type="text"
                          autoComplete="name"
                          placeholder="Masalan: Jasur Toshmatov"
                          {...registerForm.register('fullName')}
                        />
                      </FormField>

                      <FormField
                        label="Elektron pochta"
                        htmlFor="reg-email"
                        required
                        helper="Tasdiqlash havolasi ushbu manzilga yuboriladi"
                        error={registerForm.formState.errors.email?.message}
                      >
                        <Input
                          id="reg-email"
                          type="email"
                          autoComplete="email"
                          placeholder="ism@example.com"
                          {...registerForm.register('email')}
                        />
                      </FormField>

                      <FormField
                        label="Telefon raqami"
                        htmlFor="reg-phone"
                        required
                        helper="Format: +998 va 9 ta raqam"
                        error={registerForm.formState.errors.phone?.message}
                      >
                        <Input
                          id="reg-phone"
                          type="tel"
                          autoComplete="tel"
                          placeholder="+998901234567"
                          {...registerForm.register('phone')}
                        />
                      </FormField>

                      <FormField
                        label="Tuman / shahar"
                        htmlFor="reg-district"
                        required
                        helper="Namangan viloyatining 14 ta tuman va shahri"
                        error={registerForm.formState.errors.districtId?.message}
                      >
                        <Controller
                          control={registerForm.control}
                          name="districtId"
                          render={({ field }) => (
                            <SearchableSelect
                              id="reg-district"
                              placeholder="Tumanni tanlang"
                              searchPlaceholder="Tumanni qidiring..."
                              value={field.value && field.value > 0 ? field.value : null}
                              options={districtOptions}
                              onChange={(val) => field.onChange(Number(val))}
                            />
                          )}
                        />
                      </FormField>

                      <FormField
                        label="Parol"
                        htmlFor="reg-password"
                        required
                        helper="Kamida 12 ta belgi"
                        error={registerForm.formState.errors.password?.message}
                      >
                        <Input
                          id="reg-password"
                          type="password"
                          autoComplete="new-password"
                          placeholder="Kamida 12 ta belgili parol"
                          {...registerForm.register('password')}
                        />
                      </FormField>

                      <FormField
                        label="Parolni tasdiqlang"
                        htmlFor="reg-confirm"
                        required
                        error={registerForm.formState.errors.passwordConfirmation?.message}
                      >
                        <Input
                          id="reg-confirm"
                          type="password"
                          autoComplete="new-password"
                          placeholder="Parolni qayta kiriting"
                          {...registerForm.register('passwordConfirmation')}
                        />
                      </FormField>

                        <Button
                          type="submit"
                          className="w-full"
                          loading={registerForm.formState.isSubmitting}
                          loadingLabel="Tasdiqlash xati yuborilmoqda..."
                        >
                          Ro‘yxatdan o‘tish
                        </Button>
                      </form>
                      )}
                    </div>
                  )}

                  <div className="mt-[24px] text-center text-[14px] leading-[22px] text-[#64748B] dark:text-[#A7B8AE]">
                    {mode === 'login' ? (
                      <>
                        Hisobingiz yo‘qmi?{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setMode('register');
                            setServerError(null);
                          }}
                          className="font-semibold text-[#047857] dark:text-[#34D399] hover:underline cursor-pointer"
                        >
                          Ro‘yxatdan o‘tish
                        </button>
                      </>
                    ) : (
                      <>
                        Hisobingiz bormi?{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setMode('login');
                            setServerError(null);
                          }}
                          className="font-semibold text-[#047857] dark:text-[#34D399] hover:underline cursor-pointer"
                        >
                          Kirish
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        title="Parolni tiklash"
        description="Hisobingizga biriktirilgan elektron pochta manzilini kiriting. Parolni yangilash havolasi emailingizga yuboriladi."
      >
        <form onSubmit={handleForgotSubmit} className="space-y-[16px]">
          <FormField label="Elektron pochta" htmlFor="forgot-email" required>
            <Input
              id="forgot-email"
              type="email"
              required
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              placeholder="ism@example.com"
            />
          </FormField>
          {forgotInfo && (
            <div
              className={`p-[12px] rounded-[10px] text-[13px] leading-[20px] ${
                forgotInfo.ok
                  ? 'bg-[#D1FAE5] text-[#065F46] dark:bg-[#065F46]/40 dark:text-[#34D399]'
                  : 'bg-[#FEE2E2] text-[#B91C1C] dark:bg-[#7F1D1D]/40 dark:text-[#FCA5A5]'
              }`}
            >
              {forgotInfo.text}
            </div>
          )}
          <div className="flex justify-end gap-[12px]">
            <Button type="button" variant="secondary" onClick={() => setForgotOpen(false)}>
              Yopish
            </Button>
            <Button type="submit" loading={forgotLoading} loadingLabel="Yuborilmoqda...">
              Havolani yuborish
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Confirm Email when opening Sign-In Verification Link on another device */}
      <Dialog
        open={confirmLinkEmailOpen}
        onClose={() => setConfirmLinkEmailOpen(false)}
        title="Elektron pochtani tasdiqlang"
        description="Kirish havolasi boshqa qurilmada ochildi. Xavfsizlik uchun elektron pochta manzilingizni qayta kiriting."
      >
        <form onSubmit={handleConfirmLinkEmailSubmit} className="space-y-[16px]">
          <FormField label="Elektron pochta" htmlFor="confirm-link-email" required>
            <Input
              id="confirm-link-email"
              type="email"
              required
              value={confirmLinkEmail}
              onChange={(e) => setConfirmLinkEmail(e.target.value)}
              placeholder="ism@example.com"
            />
          </FormField>
          <div className="flex justify-end gap-[12px]">
            <Button type="button" variant="secondary" onClick={() => setConfirmLinkEmailOpen(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" loading={emailLinkLoading} loadingLabel="Tasdiqlanmoqda...">
              Tasdiqlash va kirish
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Invisible reCAPTCHA mount point for Firebase Phone SMS Verification */}
      <div id="yashnar-sms-recaptcha" aria-hidden="true" />
    </div>
  );
};
