// PageTransition — Wraps children with directional slide + fade.
// Direction is inferred from a tab order map so that navigating
// "forward" slides in from the right and "backward" from the left.
//
// Performance notes:
// - Amplitude kept small (12px) and scale removed: the previous 28px slide +
//   0.985 scale was the main source of the "wave/nausea" feeling users
//   reported when switching tabs while the page was mid-scroll, because the
//   transform combined with the page's scroll position to create a
//   parallax-like wobble. A small x-only translate is GPU-composited and
//   barely perceptible against scroll.
// - Honors `prefers-reduced-motion`: becomes a pure fade with no translate,
//   so users with vestibular sensitivity get a calm tab swap.
import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PageTransitionProps {
  children: React.ReactNode;
  /** Unique key for AnimatePresence (e.g. activeTab). */
  pageKey: string;
  /** Ordered list of page keys used to infer slide direction. */
  order?: string[];
}

const TAB_ORDER_DEFAULT: string[] = ['student', 'pet', 'parent', 'settings'];

// Honor the user's OS-level reduced-motion preference. framer-motion doesn't
// auto-disable transforms for this, so we gate the amplitude ourselves. Read
// at render time (not module load) so a runtime OS toggle is respected.
const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  pageKey,
  order = TAB_ORDER_DEFAULT,
}) => {
  const prevIndex = useRef<number>(order.indexOf(pageKey));

  const currentIndex = order.indexOf(pageKey);
  // Direction: 1 = forward (slide from right), -1 = backward (from left)
  let direction = 1;
  if (currentIndex !== -1 && prevIndex.current !== -1) {
    direction = currentIndex >= prevIndex.current ? 1 : -1;
  }
  // Persist for next render
  if (currentIndex !== -1) prevIndex.current = currentIndex;

  const reduced = prefersReducedMotion();
  // Small amplitude (12px) for the slide; 0 (no translate) under reduced motion.
  const slideAmplitude = reduced ? 0 : 12;

  const variants = {
    initial: (dir: number) => ({
      opacity: 0,
      x: dir > 0 ? slideAmplitude : -slideAmplitude,
    }),
    animate: { opacity: 1, x: 0 },
    exit: (dir: number) => ({
      opacity: 0,
      x: dir > 0 ? -slideAmplitude : slideAmplitude,
    }),
  };

  return (
    <AnimatePresence mode="wait" custom={direction}>
      <motion.div
        key={pageKey}
        custom={direction}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        // Short, snappy easing. `will-change` keeps the layer promoted for
        // the duration of the transition so we don't pay the paint cost on
        // the first frame of every tab switch.
        transition={{ duration: reduced ? 0.15 : 0.22, ease: [0.4, 0, 0.2, 1] }}
        style={{ width: '100%', height: '100%', willChange: 'transform, opacity' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

export default PageTransition;