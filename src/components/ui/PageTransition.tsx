// PageTransition — Wraps children with directional slide + fade.
// Direction is inferred from a tab order map so that navigating
// "forward" slides in from the right and "backward" from the left.
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

  const variants = {
    initial: (dir: number) => ({
      opacity: 0,
      x: dir > 0 ? 28 : -28,
      scale: 0.985,
    }),
    animate: { opacity: 1, x: 0, scale: 1 },
    exit: (dir: number) => ({
      opacity: 0,
      x: dir > 0 ? -24 : 24,
      scale: 0.985,
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
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        style={{ width: '100%', height: '100%' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

export default PageTransition;