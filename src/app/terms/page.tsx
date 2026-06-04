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
      title: "3. Accountability Rooms and Coins",
      content: "MoveUp provides a gamified accountability system. Coins are a virtual currency used within the platform and have no real-world monetary value. Participation in rooms involves 'committing' coins which may be lost if tasks are not completed according to the room rules.",
    },
    {
      title: "4. User Conduct",
      content: "You agree not to use the platform for any unlawful purpose or to engage in any activity that interferes with or disrupts the service. Harassment, fraud, and the submission of false proof of work are strictly prohibited.",
    },
    {
      title: "5. Termination",
      content: "We reserve the right to suspend or terminate your account at our sole discretion, without notice, for conduct that we believe violates these Terms or is harmful to other users of the platform.",
    },
    {
      title: "6. Limitation of Liability",
      content: "MoveUp is provided 'as is' without warranties of any kind. We shall not be liable for any indirect, incidental, or consequential damages arising out of your use of the platform.",
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
          <p className="text-muted-foreground">Last updated: May 14, 2026</p>
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
