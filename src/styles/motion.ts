// ═══════════════════════════════════════════════════════════════
// MOTION VARIANTS — Shared Framer Motion library
// Centralized so every component uses consistent animation language.
// ═══════════════════════════════════════════════════════════════
import type { Variants, Transition } from 'framer-motion';

// Shared easing curves
export const EASE_OUT: [number, number, number, number] = [0.4, 0, 0.2, 1];
export const EASE_SPRING: Transition = { type: 'spring', stiffness: 400, damping: 25 };
export const EASE_SPRING_SOFT: Transition = { type: 'spring', stiffness: 300, damping: 30 };

// ── Simple fades & slides ──────────────────────────────────────
export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.3, ease: EASE_OUT } },
  exit: { opacity: 0, transition: { duration: 0.2, ease: EASE_OUT } },
};

export const slideUp: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_OUT } },
  exit: { opacity: 0, y: -12, transition: { duration: 0.2, ease: EASE_OUT } },
};

export const slideDown: Variants = {
  initial: { opacity: 0, y: -16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_OUT } },
  exit: { opacity: 0, y: 16, transition: { duration: 0.2, ease: EASE_OUT } },
};

export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.92 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: EASE_OUT } },
  exit: { opacity: 0, scale: 0.92, transition: { duration: 0.2, ease: EASE_OUT } },
};

export const bounceIn: Variants = {
  initial: { opacity: 0, scale: 0.6, y: 20 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 350, damping: 18 },
  },
  exit: { opacity: 0, scale: 0.6, y: 20, transition: { duration: 0.2 } },
};

// ── Page transitions (directional) ─────────────────────────────
// Pass `direction: 1 | -1` to animate based on tab index delta
export const pageSlide: Variants = {
  initial: (direction: number = 1) => ({
    opacity: 0,
    x: direction > 0 ? 24 : -24,
    scale: 0.98,
  }),
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { duration: 0.28, ease: EASE_OUT },
  },
  exit: (direction: number = 1) => ({
    opacity: 0,
    x: direction > 0 ? -24 : 24,
    scale: 0.98,
    transition: { duration: 0.2, ease: EASE_OUT },
  }),
};

// ── Card hover / press micro-interaction ───────────────────────
export const cardHover: Variants = {
  rest: { y: 0, scale: 1, boxShadow: '0 4px 16px rgba(37, 99, 235, 0.08)' },
  hover: { y: -4, scale: 1.01, transition: { type: 'spring', stiffness: 400, damping: 25 } },
  tap: { scale: 0.98, transition: { duration: 0.1 } },
};

// ── Stagger container ──────────────────────────────────────────
export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 14 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: EASE_OUT },
  },
};

// ── Button press (3D push-down) ────────────────────────────────
export const buttonPress: Variants = {
  rest: { y: 0 },
  hover: { y: -1, transition: { type: 'spring', stiffness: 500, damping: 30 } },
  tap: { y: 3, transition: { type: 'spring', stiffness: 800, damping: 20 } },
};

// ── Floating "+XP" text ────────────────────────────────────────
export const floatingXp: Variants = {
  initial: { opacity: 0, y: 0, scale: 0.6 },
  animate: { opacity: 1, y: -48, scale: 1, transition: { duration: 0.8, ease: 'easeOut' } },
  exit: { opacity: 0, y: -72, transition: { duration: 0.3 } },
};