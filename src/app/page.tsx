"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, CheckCircle, Shield, Trophy } from "lucide-react";

export default function Home() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-8rem)]">
      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center text-center py-20 px-4">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-3xl mx-auto space-y-8"
        >
          <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-primary/30 text-sm font-medium text-primary">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Accountability, Gamified.
          </motion.div>
          
          <motion.h1 variants={itemVariants} className="text-5xl md:text-7xl font-extrabold tracking-tight">
            Commit to your goals. <br />
            <span className="text-gradient">Win the pool.</span>
          </motion.h1>

          <motion.p variants={itemVariants} className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Create private rooms, set tasks, and pay a real commitment fee. First to complete all their tasks and upload proof takes the entire reward pool.
          </motion.p>

          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
            <Link
              href="/signup"
              className="w-full sm:w-auto bg-primary text-primary-foreground px-8 py-4 rounded-xl font-bold text-lg hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 shadow-[0_0_40px_-10px_rgba(99,102,241,0.5)]"
            >
              Get Started Free
              <ArrowRight size={20} />
            </Link>
            <Link
              href="/how-it-works"
              className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-lg glass hover:bg-white/5 transition-all"
            >
              How it works
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section className="py-24 border-t border-border/50">
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {[
            {
              icon: <Shield className="text-emerald-500 w-8 h-8" />,
              title: "Private Rooms",
              desc: "Create exclusive challenge rooms for you and your friends. Set the rules and duration.",
            },
            {
              icon: <CheckCircle className="text-blue-500 w-8 h-8" />,
              title: "Verifiable Proof",
              desc: "Upload images, videos, or links to prove you've completed your tasks. Transparency first.",
            },
            {
              icon: <Trophy className="text-amber-500 w-8 h-8" />,
              title: "Winner Takes All",
              desc: "Everyone pays a real commitment fee to join. The first to reach 100% completion wins the entire pool.",
            },
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.2 }}
              className="glass-card p-8 rounded-3xl"
            >
              <div className="glass w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Don't just take our word for it.</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">See how MoveUp is changing the way people stick to their goals.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                quote: "I used to write goals and forget them a week later. Paying a real commitment fee on a 30-day coding challenge changed everything. I actually finished it.",
                author: "Sarah J.",
                role: "Software Developer"
              },
              {
                quote: "My friends and I set up a fitness room. The competition and the shared reward pool pushed us harder than any gym membership ever did.",
                author: "Michael T.",
                role: "Fitness Enthusiast"
              }
            ].map((testimonial, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="glass p-8 rounded-3xl relative"
              >
                <div className="absolute top-4 left-6 text-6xl text-primary/20 font-serif">"</div>
                <p className="text-lg mb-6 relative z-10 italic">"{testimonial.quote}"</p>
                <div>
                  <h4 className="font-bold">{testimonial.author}</h4>
                  <span className="text-sm text-muted-foreground">{testimonial.role}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 border-t border-border/50">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-6">
            {[
              { q: "How does the commitment fee work?", a: "When you join a challenge room, you pay a real commitment fee. This fee goes into a shared pool. The first person to complete 100% of their tasks and upload proof wins the entire pool. It's designed to keep everyone motivated and accountable." },
              { q: "Can others see my tasks?", a: "Tasks are private until you mark them as complete and upload proof. Once proof is uploaded, the task and proof become visible to everyone in the room." },
              { q: "What happens if a room expires?", a: "If the duration expires and no one has reached 100%, the person with the highest completion percentage wins the reward pool." },
              { q: "What kind of proof can I upload?", a: "You can upload images, videos, documents, or simply provide a text link depending on the nature of your task." },
              { q: "Is my money safe?", a: "Your wallet balance is held securely in your MoveUp account. You can request a withdrawal to your bank account at any time." },
            ].map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="glass-card p-6 rounded-2xl"
              >
                <h4 className="text-lg font-bold mb-2">{faq.q}</h4>
                <p className="text-muted-foreground">{faq.a}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
