"use client";

import { motion } from "framer-motion";
import { Check, ArrowRight } from "lucide-react";
import Link from "next/link";

const tiers = [
  {
    name: "Free",
    price: "0",
    description: "Perfect for individuals starting their accountability journey.",
    features: [
      "Join up to 2 active rooms",
      "Basic statistics",
      "Standard coin rewards",
      "Public leaderboard view",
    ],
    cta: "Get Started",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "9.99",
    description: "For serious achievers who want to maximize their growth.",
    features: [
      "Unlimited active rooms",
      "Advanced performance analytics",
      "2x coin multiplier on rewards",
      "Priority customer support",
      "Custom task categories",
    ],
    cta: "Upgrade to Pro",
    highlighted: true,
  },
  {
    name: "Team",
    price: "49",
    description: "Collaborative accountability for groups and organizations.",
    features: [
      "Everything in Pro",
      "Private team-only rooms",
      "Admin dashboard for managers",
      "Bulk member management",
      "Monthly team performance reports",
    ],
    cta: "Contact Sales",
    highlighted: false,
  },
];

export default function PricingPage() {
  return (
    <div className="flex flex-col min-h-screen py-16 px-4">
      <div className="max-w-7xl mx-auto w-full">
        <div className="text-center mb-16">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-bold mb-6 tracking-tight"
          >
            Simple, Transparent <span className="text-primary">Pricing</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground text-lg max-w-2xl mx-auto"
          >
            Invest in yourself. Choose the plan that fits your ambition and start winning the pool today.
          </motion.p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {tiers.map((tier, i) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`glass-card p-8 rounded-3xl flex flex-col relative overflow-hidden ${
                tier.highlighted ? "border-primary/50 shadow-xl shadow-primary/10" : ""
              }`}
            >
              {tier.highlighted && (
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-4 py-1 text-xs font-bold rounded-bl-xl">
                  MOST POPULAR
                </div>
              )}

              <div className="mb-8">
                <h3 className="text-xl font-bold mb-2">{tier.name}</h3>
                <p className="text-muted-foreground text-sm h-10">{tier.description}</p>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">${tier.price}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </div>

              <div className="space-y-4 mb-10 flex-1">
                {tier.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3 text-sm">
                    <div className="bg-primary/10 text-primary p-1 rounded-full shrink-0">
                      <Check size={12} />
                    </div>
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              <Link
                href={tier.cta === "Contact Sales" ? "mailto:sales@moveup.com" : "/signup"}
                className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                  tier.highlighted
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                    : "bg-secondary text-foreground hover:bg-secondary/80 border border-border"
                }`}
              >
                {tier.cta} <ArrowRight size={18} />
              </Link>
            </motion.div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {[
              { q: "Can I cancel my subscription anytime?", a: "Yes, you can cancel your Pro or Team subscription at any time from your account settings. You will maintain access until the end of your billing period." },
              { q: "What are coins used for?", a: "Coins are our platform's accountability currency. You use them to enter challenge rooms, and if you complete your tasks, you win a share of the pool!" },
              { q: "Do you offer discounts for students?", a: "Absolutely! Contact our support team with your student ID, and we'll provide a 50% discount on the Pro plan." },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="glass-card p-6 rounded-2xl"
              >
                <h4 className="font-semibold mb-2">{item.q}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
