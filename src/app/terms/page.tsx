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
      content: "You must create an account to access most features of MoveUp. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must be at least 18 years old to register.",
    },
    {
      title: "3. Commitment Fees and Real Money",
      content: "MoveUp operates with real money. When you join a challenge room, a commitment fee is deducted from your MoveUp wallet balance. This fee is pooled with all other participants' fees. The first participant to reach 100% task completion wins the entire pool. MoveUp charges a platform fee on each successful wallet funding transaction to cover operational costs. All fees are clearly disclosed before you confirm any transaction.",
    },
    {
      title: "4. Wallet and Withdrawals",
      content: "Your MoveUp wallet holds real funds. You may fund your wallet at any time. Withdrawal requests are reviewed and processed manually within 24 hours. MoveUp reserves the right to delay or withhold withdrawals pending identity verification or fraud review. We are not liable for delays caused by your bank or financial institution.",
    },
    {
      title: "5. Refund Policy",
      content: "Commitment fees paid into an active room are non-refundable once a room has started. If a room is cancelled by an administrator before it begins, all fees are returned to participants' wallets. Disputed transactions must be reported within 7 days of occurrence.",
    },
    {
      title: "6. User Conduct",
      content: "You agree not to use the platform for any unlawful purpose or to engage in any activity that interferes with or disrupts the service. Harassment, fraud, money laundering, and the submission of false or fabricated proof of work are strictly prohibited and may result in permanent account suspension and forfeiture of wallet funds.",
    },
    {
      title: "7. Termination",
      content: "We reserve the right to suspend or terminate your account at our sole discretion, without notice, for conduct that we believe violates these Terms or is harmful to other users of the platform. Upon termination for cause, remaining wallet balances may be subject to review before release.",
    },
    {
      title: "8. Limitation of Liability",
      content: "MoveUp is provided 'as is' without warranties of any kind. We shall not be liable for any indirect, incidental, or consequential damages arising out of your use of the platform. Our total liability in connection with any claim shall not exceed the amount held in your MoveUp wallet at the time of the claim.",
    },
    {
      title: "9. Changes to These Terms",
      content: "We may revise these Terms at any time. If we make material changes, we will notify you by email or through the platform. Your continued use of MoveUp after changes take effect constitutes your acceptance of the revised Terms.",
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
