"use client";

import { motion } from "framer-motion";

export default function PrivacyPage() {
  const sections = [
    {
      title: "1. Information We Collect",
      content: "We collect information you provide directly to us, such as your display name, email address, and any proof of work (text, links, or images) you submit to challenge rooms.",
    },
    {
      title: "2. How We Use Your Information",
      content: "We use the information we collect to provide, maintain, and improve our services, to process transactions, and to communicate with you about your account and platform activity.",
    },
    {
      title: "3. Data Storage and Security",
      content: "We use Supabase for secure data storage and authentication. While we strive to use commercially acceptable means to protect your personal information, we cannot guarantee its absolute security.",
    },
    {
      title: "4. Third-Party Services",
      content: "Our platform integrates with third-party services like Supabase and Google Analytics. These services have their own privacy policies governing how they handle your data.",
    },
    {
      title: "5. Cookies",
      content: "We use cookies to maintain your session and remember your preferences (such as your theme choice). You can control cookies through your browser settings.",
    },
    {
      title: "6. Changes to This Policy",
      content: "We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.",
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
          <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
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
              Your privacy is important to us. If you have any questions, reach out at privacy@moveup.com.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
