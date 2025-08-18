import { motion } from "framer-motion";
import { ReactNode } from "react";

interface SignupStepProps {
  children: ReactNode;
  delay?: number;
}

export function SignupStep({ children, delay = 0 }: SignupStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
    >
      {children}
    </motion.div>
  );
}
