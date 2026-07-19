import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { User, Shield, Lock, Mail, ArrowLeft, CheckCircle2, ShieldAlert, Eye, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { encryptData, decryptData } from '../utils/crypto';
import { supabase } from '../services/supabase';
import { Globe } from 'lucide-react';

export interface AuthUser {
  name: string;
  role: 'student' | 'parent';
  linkedCode?: string; // Only for student (their own code)
  parentLinkedCode?: string; // Code parent entered to track student
}

interface AuthScreenProps {
  onLogin: (user: AuthUser) => void;
}

const generateLinkCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
};

// Generates a 6-character OTP with exactly 3 letters and 3 numbers (e.g. A2B8C9)
const generateVerificationCode = () => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const chars: string[] = [];
  
  for (let i = 0; i < 3; i++) {
    chars.push(letters.charAt(Math.floor(Math.random() * letters.length)));
    chars.push(numbers.charAt(Math.floor(Math.random() * numbers.length)));
  }
  
  // Shuffle chars array
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
  
  // OTP Verification States
  const [isVerifying, setIsVerifying] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [pendingUser, setPendingUser] = useState<(AuthUser & { password: string }) | null>(null);
  const [pendingEmail, setPendingEmail] = useState('');
  const [showMockEmailModal, setShowMockEmailModal] = useState(false);

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
    
    if (isLogin) {
      if (supabase) {
        // Supabase Auth Login
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        
        if (signInError) {
          let friendlyMessage = signInError.message;
          if (signInError.message.includes('Failed to fetch')) {
            friendlyMessage = 'Không thể kết nối đến máy chủ Supabase. Vui lòng kiểm tra mạng, hoặc tắt Trình chặn quảng cáo (Adblocker / Brave Shield) và thử lại!';
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
            parentLinkedCode: metadata.parentLinkedCode
          });
        }
      } else {
        // Fallback to localStorage
        const users: Record<string, AuthUser & { password: string }> = getUsers();
        if (users[email]) {
          if (users[email].password === password) {
            const { password: _, ...userWithoutPassword } = users[email];
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
      // Register validation
      if (!email || !password || !name) {
        setError(t('auth.fillAllFields'));
        toast.error('Vui lòng điền đầy đủ thông tin!');
        return;
      }

      if (!validateEmailOrUsername(email)) {
        setError('Vui lòng nhập Email hợp lệ hoặc Tên đăng nhập (3-20 ký tự, không dấu, không khoảng trắng, chỉ dùng chữ, số và dấu gạch dưới).');
        toast.error('Định dạng không hợp lệ!');
        return;
      }
      
      const isEmailInput = email.includes('@');
      
      if (supabase && isEmailInput) {
        // Supabase Auth Register (Only for emails)
        const linkedCode = role === 'student' ? generateLinkCode() : undefined;
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
              role,
              linkedCode
            }
          }
        });
        
        if (signUpError) {
          let friendlyMessage = signUpError.message;
          if (signUpError.message.includes('Failed to fetch')) {
            friendlyMessage = 'Không thể kết nối đến máy chủ Supabase. Vui lòng kiểm tra mạng, hoặc tắt Trình chặn quảng cáo (Adblocker / Brave Shield) và thử lại!';
          }
          setError(friendlyMessage);
          toast.error(friendlyMessage);
          console.error('Supabase Register Error:', signUpError);
          return;
        }
        
        toast.success(t('auth.registerSuccess'));
        if (data.session) {
          onLogin({
            name,
            role,
            linkedCode
          });
        } else {
          toast.success('Vui lòng kiểm tra email của bạn để xác thực tài khoản!', { duration: 6000 });
        }
      } else {
        // Fallback to Mock Auth (or Username since Supabase needs real email)
        const users: Record<string, AuthUser & { password: string }> = getUsers();
        
        if (users[email]) {
          const errMsg = isEmailInput ? 'Email này đã được sử dụng!' : 'Tên đăng nhập này đã được sử dụng!';
          setError(errMsg);
          toast.error(errMsg);
          return;
        }

        // Generate OTP Code (3 letters + 3 numbers)
        const otp = generateVerificationCode();
        setGeneratedOtp(otp);
        setPendingEmail(email);
        
        const newUser: AuthUser & { password: string } = {
          name,
          role,
          password,
          linkedCode: role === 'student' ? generateLinkCode() : undefined
        };
        
        setPendingUser(newUser);
        setIsVerifying(true);
        
        // Simulate sending verification code
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

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (otpCode.toUpperCase() === generatedOtp) {
      if (pendingUser && pendingEmail) {
        const users = getUsers();
        
        users[pendingEmail] = pendingUser;
        localStorage.setItem('oliver_users', encryptData(users));
        
        toast.success('Kích hoạt tài khoản thành công! 🌟');
        const { password: _, ...userWithoutPassword } = pendingUser;
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
    toast.success('Đã gửi lại mã xác nhận mới!');
    console.log(`[MOCK EMAIL SERVICE] Resent verification code ${otp} to ${pendingEmail}`);
    setShowMockEmailModal(true);
  };

  if (isVerifying) {
    return (
      <motion.div
        className="w-full min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1E1B4B 0%, #0F0D1A 50%, #1E1B4B 100%)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {/* Decorative orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ background: 'rgba(124, 58, 237, 0.2)' }}></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ background: 'rgba(168, 85, 247, 0.15)', animationDelay: '2s' }}></div>

        <motion.div
          className="relative z-10 w-full max-w-md p-6 sm:p-8 text-white"
          style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(24px)', borderRadius: 'var(--radius-2xl)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 50px rgba(0,0,0,0.4)' }}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <motion.button 
            onClick={() => setIsVerifying(false)}
            className="absolute top-6 left-6 p-2 rounded-full transition-colors text-white"
            style={{ background: 'rgba(255,255,255,0.1)' }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <ArrowLeft size={20} />
          </motion.button>

          <div className="text-center mb-8 mt-4">
            <motion.div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white mx-auto mb-4"
              style={{ background: 'linear-gradient(135deg, var(--secondary), #059669)', boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)' }}
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
            >
              <CheckCircle2 size={32} />
            </motion.div>
            <h2 className="text-2xl font-black tracking-tight text-white">Xác Minh Tài Khoản</h2>
            <p className="text-gray-300 mt-2 text-sm">
              Chúng tôi đã gửi một mã xác nhận gồm 6 ký tự (3 chữ, 3 số) đến {pendingEmail.includes('@') ? 'email' : 'tên đăng nhập'} <span className="font-bold" style={{ color: 'var(--primary)' }}>{pendingEmail}</span>.
            </p>
          </div>

          {error && (
            <motion.div
              className="p-3 rounded-xl mb-6 text-sm font-medium flex items-center gap-2"
              style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#FCA5A5', border: '1px solid rgba(239, 68, 68, 0.3)' }}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
            >
              <ShieldAlert size={16} />
              <span>{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 text-center">Nhập mã xác nhận</label>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="w-full p-4 text-center font-black tracking-[0.3em] text-2xl text-white placeholder-gray-600 transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', border: '2px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-lg)', outline: 'none' }}
                placeholder="A1B2C3"
                maxLength={6}
                required
              />
            </div>

            <motion.button 
              type="submit" 
              className="btn-3d btn-3d-secondary w-full py-4 text-lg"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              Kích hoạt tài khoản
            </motion.button>
          </form>

          <div className="mt-8 text-center pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <p className="text-sm text-gray-400">Không nhận được mã?</p>
            <button
              onClick={handleResendOtp}
              className="font-bold mt-2 hover:underline transition-all"
              style={{ color: 'var(--primary)' }}
            >
              {t('auth.resendCode')}
            </button>
          </div>
        </motion.div>

        {showMockEmailModal && (() => {
          const isEmailInput = pendingEmail.includes('@');
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}>
              <motion.div
                className="p-8 max-w-sm w-full text-center relative"
                style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-xl)' }}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                 <button onClick={() => setShowMockEmailModal(false)} className="absolute top-4 right-4" style={{ color: 'var(--text-muted)' }}>
                   <X size={20} />
                 </button>
                 <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--primary-light)' }}>
                   {isEmailInput ? <Mail size={32} style={{ color: 'var(--primary)' }} /> : <User size={32} style={{ color: 'var(--primary)' }} />}
                 </div>
                 <h3 className="text-2xl font-black mb-2" style={{ color: 'var(--text-main)' }}>
                   {isEmailInput ? t('auth.mockEmailTitle') : t('auth.mockAuthTitle')}
                 </h3>
                 <p className="mb-6 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                   {isEmailInput ? t('auth.mockEmailDesc') : t('auth.mockAuthDesc')}
                 </p>
                 <div className="text-4xl font-black tracking-[0.2em] mb-6 py-3 rounded-xl" style={{ color: 'var(--primary)', background: 'var(--primary-light)', border: '2px solid rgba(124,58,237,0.2)' }}>
                   {generatedOtp}
                 </div>
                 <motion.button
                   onClick={() => setShowMockEmailModal(false)}
                   className="btn-3d btn-3d-primary w-full py-3"
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

  return (
    <motion.div
      className="w-full min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'var(--bg-page)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Background Decor */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ background: 'rgba(124, 58, 237, 0.15)' }}></div>
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ background: 'rgba(168, 85, 247, 0.1)', animationDelay: '2s' }}></div>

      {/* Language Toggle */}
      <motion.div
        className="absolute top-6 right-6 z-50 flex items-center gap-2 px-4 py-2 rounded-full"
        style={{ background: 'var(--bg-card)', border: '2px solid rgba(124,58,237,0.1)', boxShadow: 'var(--shadow-md)' }}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <Globe size={16} style={{ color: 'var(--primary)' }} />
        <button 
          onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
          className="text-sm font-bold flex items-center gap-2"
          style={{ color: 'var(--text-main)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <span style={{ color: lang === 'vi' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: lang === 'vi' ? 900 : 600 }}>VI</span>
          <span
            style={{
              width: 32,
              height: 18,
              background: 'var(--primary)',
              borderRadius: 9999,
              position: 'relative',
              display: 'inline-block',
            }}
          >
            <motion.span
              style={{
                position: 'absolute',
                top: 2,
                left: 2,
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: 'white',
              }}
              animate={{ x: lang === 'en' ? 14 : 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </span>
          <span style={{ color: lang === 'en' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: lang === 'en' ? 900 : 600 }}>EN</span>
        </button>
      </motion.div>

      {/* Main Card */}
      <motion.div
        className="relative z-10 w-full max-w-md p-8 sm:p-10"
        style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-xl)', border: '1px solid rgba(124,58,237,0.08)' }}
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        <div className="text-center mb-8">
          <motion.div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-white mx-auto mb-6"
            style={{ background: 'linear-gradient(135deg, var(--primary), #A855F7)', boxShadow: 'var(--shadow-glow-primary)' }}
            whileHover={{ scale: 1.05, rotate: 3 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            <Eye size={40} />
          </motion.div>
          <AnimatePresence mode="wait">
            <motion.div
              key={isLogin ? 'login' : 'register'}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="text-3xl font-black tracking-tight" style={{ color: 'var(--text-main)' }}>
                {isLogin ? t('auth.loginTitle') : t('auth.registerTitle')}
              </h2>
              <p className="mt-2 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                {isLogin ? t('auth.loginDesc') : t('auth.registerDesc')}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {error && (
          <motion.div
            className="p-3 rounded-xl mb-6 text-sm font-medium flex items-center gap-2"
            style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)' }}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
          >
            <ShieldAlert size={16} className="flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <AnimatePresence>
          {!isLogin && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{ overflow: 'hidden' }}
            >
              {/* Duolingo-style Pill Toggle for Role */}
              <div className="flex rounded-xl overflow-hidden mb-4" style={{ background: 'var(--primary-light)', padding: 4 }}>
                <motion.button
                  type="button"
                  onClick={() => setRole('student')}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm transition-colors"
                  style={{
                    background: role === 'student' ? 'var(--primary)' : 'transparent',
                    color: role === 'student' ? 'white' : 'var(--text-secondary)',
                    boxShadow: role === 'student' ? 'var(--shadow-glow-primary)' : 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  whileTap={{ scale: 0.95 }}
                >
                  <User size={18} />
                  {t('auth.roleStudent')}
                </motion.button>
                <motion.button
                  type="button"
                  onClick={() => setRole('parent')}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm transition-colors"
                  style={{
                    background: role === 'parent' ? 'var(--primary)' : 'transparent',
                    color: role === 'parent' ? 'white' : 'var(--text-secondary)',
                    boxShadow: role === 'parent' ? 'var(--shadow-glow-primary)' : 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Shield size={18} />
                  {t('auth.roleParent')}
                </motion.button>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{t('auth.fullName')}</label>
                <div className="relative">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 transition-all"
                    style={{ borderRadius: 'var(--radius-md)', background: 'var(--bg-page)', border: '2px solid rgba(124,58,237,0.1)', color: 'var(--text-main)', outline: 'none', fontFamily: 'var(--font-sans)' }}
                    placeholder="Nguyễn Văn A"
                  />
                  <div className="absolute left-3 top-3.5" style={{ color: 'var(--text-muted)' }}>
                    <User size={18} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          </AnimatePresence>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{t('auth.emailOrUsername')}</label>
            <div className="relative">
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 transition-all"
                style={{ borderRadius: 'var(--radius-md)', background: 'var(--bg-page)', border: '2px solid rgba(124,58,237,0.1)', color: 'var(--text-main)', outline: 'none', fontFamily: 'var(--font-sans)' }}
                placeholder={t('auth.emailOrUsername')}
                required
              />
              <div className="absolute left-3 top-3.5" style={{ color: 'var(--text-muted)' }}>
                {email && !email.includes('@') ? <User size={18} /> : <Mail size={18} />}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{t('auth.password')}</label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 transition-all"
                style={{ borderRadius: 'var(--radius-md)', background: 'var(--bg-page)', border: '2px solid rgba(124,58,237,0.1)', color: 'var(--text-main)', outline: 'none', fontFamily: 'var(--font-sans)' }}
                placeholder="••••••••"
                required
              />
              <div className="absolute left-3 top-3.5" style={{ color: 'var(--text-muted)' }}>
                <Lock size={18} />
              </div>
            </div>
          </div>

          <motion.button 
            type="submit" 
            className="btn-3d btn-3d-primary w-full py-4 text-lg mt-8"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
            {isLogin ? t('auth.loginBtn') : t('auth.registerBtn')}
          </motion.button>
        </form>

        <div className="mt-8 text-center pt-6 flex flex-col items-center gap-4" style={{ borderTop: '1px solid rgba(124,58,237,0.08)' }}>
          <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            {isLogin ? t('auth.newToApp') : t('auth.alreadyHaveAccount')}
          </span>
          <motion.button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="btn-3d btn-3d-ghost w-full py-3.5"
            whileTap={{ scale: 0.97 }}
          >
            {isLogin ? t('auth.switchToRegisterBtn') : t('auth.switchToLoginBtn')}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AuthScreen;
