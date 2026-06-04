"use client";

import { motion } from "framer-motion";

export default function TermsPage() {
  const sections = [
    {
      title: "1. Acceptance of Terms",
      content: "By accessing or using MoveUp, you agree to be bound by these Terms of Service. If you do not agree to all of these terms, do not use the platform.",
    },
    {
      title: "2. Account Registration",
      content: "You must create an account to access most features of MoveUp. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.",
    },
    {
      title: "3. Wallets, Fees, and Challenge Pools",
      content: "MoveUp operates a real-money wallet system in Nigerian Naira (₦). Deposited funds are used to pay room commitment entry fees, which are pooled together. These pooled fees are awarded to the winners or top performers based on the room's AI-scored completion leaderboard. All withdrawals are processed immediately to your linked local bank account.",
    },
    {
      title: "4. User Conduct and AI Integrity",
      content: "You agree to use the platform only for lawful accountability challenges. Submitting forged proofs, plagiarized screenshots, deceptive links, or trying to manipulate the automated AI grading engine is strictly prohibited and constitutes a material breach of these terms.",
    },
    {
      title: "5. Termination and Forfeiture",
      content: "We reserve the right to suspend or terminate your account and forfeit any remaining wallet balances, without notice, for fraudulent behavior, proof forgery, or conduct that violates these Terms.",
    },
    {
      title: "6. Limitation of Liability",
      content: "MoveUp is provided 'as is' without warranties of any kind. We are not liable for any indirect, incidental, or consequential losses, including lost commitment fees, resulting from platform downtime or AI scoring evaluations.",
    },
  ];

  return (
    <div className="flex flex-col min-h-screen py-16 px-4">
      <div className="max-w-4xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 text-center"
        >
          <h1 className="text-4xl font-bold mb-4">Terms of Service</h1>
          <p className="text-muted-foreground">Last updated: June 4, 2026</p>
        </motion.div>

        <div className="glass-card p-8 md:p-12 rounded-3xl space-y-8">
          {sections.map((section, i) => (
            <motion.section
              key={i}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <h2 className="text-xl font-bold mb-4 text-primary">{section.title}</h2>
              <p className="text-muted-foreground leading-relaxed">
                {section.content}
              </p>
            </motion.section>
          ))}

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="pt-8 border-t border-border"
          >
            <p className="text-sm text-muted-foreground italic">
              Questions about our Terms? Please contact us at legal@moveup.com.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
