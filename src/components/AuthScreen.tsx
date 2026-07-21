import React, { useState, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  User,
  Shield,
  Lock,
  Mail,
  ArrowLeft,
  CheckCircle2,
  ShieldAlert,
  Eye,
  X,
  Globe,
  Activity,
  PawPrint,
  TrendingUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { encryptData, decryptData } from '../utils/crypto';
import { supabase } from '../services/supabase';
import styles from './AuthScreen.module.css';

export interface AuthUser {
  name: string;
  role: 'student' | 'parent';
  linkedCode?: string;
  parentLinkedCode?: string;
}

interface AuthScreenProps {
  onLogin: (user: AuthUser) => void;
}

const generateLinkCode = () => Math.floor(100000 + Math.random() * 900000).toString();

const generateVerificationCode = () => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const chars: string[] = [];
  for (let i = 0; i < 3; i++) {
    chars.push(letters.charAt(Math.floor(Math.random() * letters.length)));
    chars.push(numbers.charAt(Math.floor(Math.random() * numbers.length)));
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
};

const validateEmailOrUsername = (input: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return emailRegex.test(input) || usernameRegex.test(input);
};

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const { t, lang, setLang } = useLanguage();
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<'student' | 'parent'>('student');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const [error, setError] = useState('');

  // OTP verification states
  const [isVerifying, setIsVerifying] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [pendingUser, setPendingUser] = useState<(AuthUser & { password: string }) | null>(null);
  const [pendingEmail, setPendingEmail] = useState('');
  const [showMockEmailModal, setShowMockEmailModal] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const getUsers = () => {
    const usersData = localStorage.getItem('oliver_users');
    if (!usersData) return {};
    try {
      const decrypted = decryptData(usersData);
      if (decrypted) return decrypted;
      return JSON.parse(usersData);
    } catch {
      return {};
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const isEmailInput = email.includes('@');
    // Supabase Auth only accepts real emails — usernames are not supported
    // when the project is connected to Supabase. Reject early with a clear message.
    if (supabase && !isEmailInput) {
      const msg = 'Khi kết nối Supabase, vui lòng dùng Email hợp lệ để đăng ký/đăng nhập (không hỗ trợ tên đăng nhập).';
      setError(msg);
      toast.error(msg);
      return;
    }

    if (isLogin) {
      const supabaseEmail = isEmailInput ? email : `${email}@antihunchback.local`;

      if (supabase) {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: supabaseEmail,
          password,
        });
        if (signInError) {
          let friendlyMessage = signInError.message;
          if (signInError.message.includes('Failed to fetch')) {
            friendlyMessage =
              'Không thể kết nối đến máy chủ Supabase. Vui lòng kiểm tra mạng, hoặc tắt Trình chặn quảng cáo (Adblocker / Brave Shield) và thử lại!';
          }
          setError(friendlyMessage);
          toast.error(friendlyMessage);
          console.error('Supabase Login Error:', signInError);
          return;
        }
        if (data.user) {
          const metadata = data.user.user_metadata || {};
          toast.success(t('auth.loginSuccess'));
          onLogin({
            name: metadata.name || email.split('@')[0],
            role: metadata.role || 'student',
            linkedCode: metadata.linkedCode,
            parentLinkedCode: metadata.parentLinkedCode,
          });
        }
      } else {
        const users: Record<string, AuthUser & { password: string }> = getUsers();
        if (users[email]) {
          if (users[email].password === password) {
            const { password: _pw, ...userWithoutPassword } = users[email];
            toast.success('Đăng nhập thành công (Local)! 🎉');
            onLogin(userWithoutPassword);
          } else {
            setError(t('auth.invalidCredentials'));
            toast.error('Mật khẩu không đúng!');
          }
        } else {
          setError(t('auth.invalidCredentials'));
          toast.error('Tài khoản không tồn tại!');
        }
      }
    } else {
      if (!email || !password || !name) {
        setError(t('auth.fillAllFields'));
        toast.error('Vui lòng điền đầy đủ thông tin!');
        return;
      }
      if (!validateEmailOrUsername(email)) {
        setError(
          'Vui lòng nhập Email hợp lệ hoặc Tên đăng nhập (3-20 ký tự, không dấu, không khoảng trắng, chỉ dùng chữ, số và dấu gạch dưới).',
        );
        toast.error('Định dạng không hợp lệ!');
        return;
      }

      const supabaseEmail = isEmailInput ? email : `${email}@antihunchback.local`;

      if (supabase) {
        const linkedCode = role === 'student' ? generateLinkCode() : undefined;
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: supabaseEmail,
          password,
          options: { data: { name, role, linkedCode } },
        });
        if (signUpError) {
          let friendlyMessage = signUpError.message;
          if (signUpError.message.includes('Failed to fetch')) {
            friendlyMessage =
              'Không thể kết nối đến máy chủ Supabase. Vui lòng kiểm tra mạng, hoặc tắt Trình chặn quảng cáo (Adblocker / Brave Shield) và thử lại!';
          }
          setError(friendlyMessage);
          toast.error(friendlyMessage);
          console.error('Supabase Register Error:', signUpError);
          return;
        }
        toast.success(t('auth.registerSuccess'));
        if (data.session) {
          onLogin({ name, role, linkedCode });
        } else {
          toast.success('Vui lòng kiểm tra email của bạn để xác thực tài khoản!', { duration: 6000 });
        }
      } else {
        const users: Record<string, AuthUser & { password: string }> = getUsers();
        if (users[email]) {
          const errMsg = isEmailInput ? 'Email này đã được sử dụng!' : 'Tên đăng nhập này đã được sử dụng!';
          setError(errMsg);
          toast.error(errMsg);
          return;
        }
        const otp = generateVerificationCode();
        setGeneratedOtp(otp);
        setPendingEmail(email);
        const newUser: AuthUser & { password: string } = {
          name,
          role,
          password,
          linkedCode: role === 'student' ? generateLinkCode() : undefined,
        };
        setPendingUser(newUser);
        setIsVerifying(true);
        setOtpDigits(['', '', '', '', '', '']);
        if (isEmailInput) {
          console.log(`[MOCK EMAIL SERVICE] Sent verification code ${otp} to ${email}`);
          toast.success(`Mã xác nhận đã gửi đến email ${email}!`, { duration: 6000 });
        } else {
          console.log(`[MOCK USERNAME SERVICE] Generated verification code ${otp} for username ${email}`);
          toast.success(`Mã xác nhận đã được tạo cho tên đăng nhập ${email}!`, { duration: 6000 });
        }
        setShowMockEmailModal(true);
      }
    }
  };

  const handleOtpChange = (idx: number, val: string) => {
    const clean = val.replace(/[^A-Za-z0-9]/g, '').slice(-1);
    const next = [...otpDigits];
    next[idx] = clean;
    setOtpDigits(next);
    if (clean && idx < 5 && otpRefs.current[idx + 1]) {
      otpRefs.current[idx + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[idx] && idx > 0 && otpRefs.current[idx - 1]) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
    if (!text) return;
    const next = Array.from({ length: 6 }, (_, i) => text[i] ?? '');
    setOtpDigits(next);
    const lastFilled = Math.min(text.length, 6) - 1;
    otpRefs.current[Math.max(0, lastFilled)]?.focus();
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const entered = otpDigits.join('').toUpperCase();
    if (entered === generatedOtp) {
      if (pendingUser && pendingEmail) {
        const users = getUsers();
        users[pendingEmail] = pendingUser;
        localStorage.setItem('oliver_users', encryptData(users));
        toast.success('Kích hoạt tài khoản thành công! 🌟');
        const { password: _pw, ...userWithoutPassword } = pendingUser;
        onLogin(userWithoutPassword);
      }
    } else {
      setError('Mã xác nhận không chính xác. Vui lòng thử lại.');
      toast.error('Sai mã xác nhận!');
    }
  };

  const handleResendOtp = () => {
    const otp = generateVerificationCode();
    setGeneratedOtp(otp);
    setOtpDigits(['', '', '', '', '', '']);
    toast.success('Đã gửi lại mã xác nhận mới!');
    console.log(`[MOCK EMAIL SERVICE] Resent verification code ${otp} to ${pendingEmail}`);
    setShowMockEmailModal(true);
  };

  // ── OTP verification screen ───────────────────────────────────────
  if (isVerifying) {
    return (
      <motion.div
        className={styles.otpScreen}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {/* Decorative orbs */}
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-[120px] pointer-events-none animate-pulse"
          style={{ background: 'rgba(124, 58, 237, 0.2)' }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-[120px] pointer-events-none animate-pulse"
          style={{ background: 'rgba(168, 85, 247, 0.15)', animationDelay: '2s' }}
        />

        <motion.div
          className={styles.otpCard}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <motion.button
            onClick={() => setIsVerifying(false)}
            className={styles.backBtn}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <ArrowLeft size={20} />
          </motion.button>

          <div className={styles.otpHeader}>
            <motion.div
              className={styles.otpBadge}
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
            >
              <CheckCircle2 size={30} />
            </motion.div>
            <h2 className={styles.otpTitle}>Xác Minh Tài Khoản</h2>
            <p className={styles.otpDesc}>
              Chúng tôi đã gửi một mã xác nhận gồm 6 ký tự (3 chữ, 3 số) đến{' '}
              {pendingEmail.includes('@') ? 'email' : 'tên đăng nhập'}{' '}
              <span className={styles.otpEmailTarget}>{pendingEmail}</span>.
            </p>
          </div>

          {error && (
            <motion.div
              className={styles.otpError}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
            >
              <ShieldAlert size={16} />
              <span>{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleVerifyOtp}>
            <label className={styles.otpLabel}>Nhập mã xác nhận</label>
            <div className={styles.otpBoxes} onPaste={handleOtpPaste}>
              {otpDigits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    otpRefs.current[i] = el;
                  }}
                  type="text"
                  value={d}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className={`${styles.otpBox} ${d ? styles.filled : ''}`}
                  maxLength={1}
                  required
                  autoCapitalize="characters"
                />
              ))}
            </div>

            <motion.button
              type="submit"
              className={`btn-3d btn-3d-secondary ${styles.submitBtn}`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              Kích hoạt tài khoản
            </motion.button>
          </form>

          <div className={styles.otpFooter}>
            <p className={styles.otpFooterText}>Không nhận được mã?</p>
            <button onClick={handleResendOtp} className={styles.otpResend}>
              {t('auth.resendCode')}
            </button>
          </div>
        </motion.div>

        {showMockEmailModal &&
          (() => {
            const isEmailInput = pendingEmail.includes('@');
            return (
              <div className={styles.mockModal}>
                <motion.div
                  className={styles.mockCard}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <button onClick={() => setShowMockEmailModal(false)} className={styles.mockClose}>
                    <X size={20} />
                  </button>
                  <div className={styles.mockIconWrap}>
                    {isEmailInput ? <Mail size={30} /> : <User size={30} />}
                  </div>
                  <h3 className={styles.mockTitle}>
                    {isEmailInput ? t('auth.mockEmailTitle') : t('auth.mockAuthTitle')}
                  </h3>
                  <p className={styles.mockDesc}>
                    {isEmailInput ? t('auth.mockEmailDesc') : t('auth.mockAuthDesc')}
                  </p>
                  <div className={styles.mockCode}>{generatedOtp}</div>
                  <motion.button
                    onClick={() => setShowMockEmailModal(false)}
                    className="btn-3d btn-3d-primary w-full"
                    whileTap={{ scale: 0.97 }}
                  >
                    {t('auth.closeBtn')}
                  </motion.button>
                </motion.div>
              </div>
            );
          })()}
      </motion.div>
    );
  }

  // ── Login / Register screen ────────────────────────────────────────
  return (
    <motion.div
      className={styles.screen}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Left: Illustration panel */}
      <div className={styles.illustration}>
        <div className={styles.illContent}>
          <div className={styles.illLogo}>
            <Eye size={36} className="text-white" />
          </div>
          <h1 className={styles.illTitle}>MediEdu Anti-Hunchback</h1>
          <p className={styles.illSubtitle}>
            Giúp con bạn ngồi thẳng lưng, giữ khoảng cách mắt an toàn và tập thói quen học tập lành mạnh — cùng thú cưng Oliver.
          </p>
          <div className={styles.illFeatures}>
            <div className={styles.illFeature}>
              <div className={styles.illFeatureDot}>
                <Activity size={18} className="text-white" />
              </div>
              <span>Theo dõi tư thế theo thời gian thực</span>
            </div>
            <div className={styles.illFeature}>
              <div className={styles.illFeatureDot}>
                <PawPrint size={18} className="text-white" />
              </div>
              <span>Thú cưng Oliver grows cùng thói quen tốt</span>
            </div>
            <div className={styles.illFeature}>
              <div className={styles.illFeatureDot}>
                <TrendingUp size={18} className="text-white" />
              </div>
              <span>Báo cáo sức khỏe chi tiết cho phụ huynh</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Form panel */}
      <div className={styles.formPanel}>
        {/* Language toggle */}
        <motion.div
          className={styles.langToggle}
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Globe size={16} style={{ color: 'var(--primary)' }} />
          <button
            onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
            className={styles.langBtn}
          >
            <span className={lang === 'vi' ? styles.langActive : styles.langInactive}>VI</span>
            <span className={styles.langTrack}>
              <motion.span
                className={styles.langThumb}
                animate={{ x: lang === 'en' ? 14 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </span>
            <span className={lang === 'en' ? styles.langActive : styles.langInactive}>EN</span>
          </button>
        </motion.div>

        <motion.div
          className={styles.card}
          initial={{ scale: 0.92, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <div className={styles.header}>
            <div className={styles.brandIcon}>
              <Eye size={28} className="text-white" />
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={isLogin ? 'login' : 'register'}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <h2 className={styles.title}>
                  {isLogin ? t('auth.loginTitle') : t('auth.registerTitle')}
                </h2>
                <p className={styles.subtitle}>
                  {isLogin ? t('auth.loginDesc') : t('auth.registerDesc')}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {error && (
            <motion.div
              className={styles.error}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
            >
              <ShieldAlert size={16} />
              <span>{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit}>
            <AnimatePresence>
              {!isLogin && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  style={{ overflow: 'hidden' }}
                >
                  {/* Role selection cards */}
                  <div className={styles.roleRow}>
                    <motion.div
                      className={`${styles.roleCard} ${role === 'student' ? styles.roleCardActive : ''}`}
                      onClick={() => setRole('student')}
                      whileTap={{ scale: 0.97 }}
                    >
                      <div className={styles.roleIconWrap}>
                        <User size={22} />
                      </div>
                      <span className={styles.roleName}>{t('auth.roleStudent')}</span>
                      <span className={styles.roleDesc}>Học sinh từ 5–15 tuổi</span>
                    </motion.div>
                    <motion.div
                      className={`${styles.roleCard} ${role === 'parent' ? styles.roleCardActive : ''}`}
                      onClick={() => setRole('parent')}
                      whileTap={{ scale: 0.97 }}
                    >
                      <div className={styles.roleIconWrap}>
                        <Shield size={22} />
                      </div>
                      <span className={styles.roleName}>{t('auth.roleParent')}</span>
                      <span className={styles.roleDesc}>Phụ huynh theo dõi con</span>
                    </motion.div>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>{t('auth.fullName')}</label>
                    <div className={styles.inputWrap}>
                      <span className={styles.inputIcon}>
                        <User size={18} />
                      </span>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={styles.input}
                        placeholder="Nguyễn Văn A"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className={styles.field}>
              <label className={styles.label}>{t('auth.emailOrUsername')}</label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}>
                  {email && !email.includes('@') ? <User size={18} /> : <Mail size={18} />}
                </span>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles.input}
                  placeholder={t('auth.emailOrUsername')}
                  required
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>{t('auth.password')}</label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}>
                  <Lock size={18} />
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={styles.input}
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <motion.button
              type="submit"
              className={`btn-3d btn-3d-primary ${styles.submitBtn}`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              {isLogin ? t('auth.loginBtn') : t('auth.registerBtn')}
            </motion.button>
          </form>

          <div className={styles.footer}>
            <span className={styles.footerText}>
              {isLogin ? t('auth.newToApp') : t('auth.alreadyHaveAccount')}
            </span>
            <motion.button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className={`btn-3d btn-3d-ghost ${styles.switchBtn}`}
              whileTap={{ scale: 0.97 }}
            >
              {isLogin ? t('auth.switchToRegisterBtn') : t('auth.switchToLoginBtn')}
            </motion.button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default AuthScreen;