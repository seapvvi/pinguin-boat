// Toutes les transitions du projet passent par ce fichier.
// Style : rapide, carré, Windows 10-like — spring tendu, pas de rebond excessif.

export const SPRING_SNAPPY = {
  type: 'spring' as const,
  stiffness: 600,
  damping: 35,
  mass: 0.8,
};

export const SPRING_BOUNCY = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 22,
  mass: 0.9,
};

export const SPRING_GENTLE = {
  type: 'spring' as const,
  stiffness: 280,
  damping: 28,
  mass: 1,
};

export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

// Variants réutilisables pour les listes (stagger)
export const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.04, delayChildren: 0.05 },
  },
};

export const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { ...SPRING_SNAPPY } },
};

// Variant d'entrée de page
export const pageVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: EASE_OUT_EXPO },
  },
};

// Variante réduite pour prefers-reduced-motion
// (uniquement opacity, pas de déplacement)
export const pageVariantsReduced = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
};

