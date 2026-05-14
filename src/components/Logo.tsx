"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function Logo({ className, size = 24 }: { className?: string; size?: number }) {
  const circleSize = size * 0.4;
  
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("overflow-visible", className)}
    >
      {/* Bottom Circle */}
      <motion.circle
        cx="6"
        cy="18"
        r="5"
        stroke="currentColor"
        strokeWidth="2"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0 }}
      />
      
      {/* Middle Circle */}
      <motion.circle
        cx="12"
        cy="12"
        r="5"
        stroke="currentColor"
        strokeWidth="2"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      />
      
      {/* Top Circle */}
      <motion.circle
        cx="18"
        cy="6"
        r="5"
        stroke="currentColor"
        strokeWidth="2"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      />
    </svg>
  );
}
