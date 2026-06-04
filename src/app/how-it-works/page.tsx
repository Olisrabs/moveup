"use client";

import { motion } from "framer-motion";
import { PlusCircle, KeyRound, UploadCloud, Trophy, Wallet } from "lucide-react";

export default function HowItWorks() {
  const steps = [
    {
      icon: <Wallet className="w-8 h-8 text-indigo-400" />,
      title: "1. Fund Your Wallet",
      desc: "Sign up and securely fund your wallet with Naira (₦) to join active rooms."
    },
    {
      icon: <PlusCircle className="w-8 h-8 text-blue-400" />,
      title: "2. Create or Join a Room",
      desc: "Create a private accountability room with a customized entry commitment fee (₦) and duration, or join a room using a unique code."
    },
    {
      icon: <KeyRound className="w-8 h-8 text-purple-400" />,
      title: "3. Set Your Tasks",
      desc: "Once inside, list your personal tasks. These remain private until you decide to complete them."
    },
    {
      icon: <UploadCloud className="w-8 h-8 text-emerald-400" />,
      title: "4. Upload Proof & Get Graded",
      desc: "Complete a task? Mark it done and submit text descriptions, links, or screenshot images. Our advanced AI scans the proof and updates the room leaderboard."
    },
    {
      icon: <Trophy className="w-8 h-8 text-amber-400" />,
      title: "5. Win the Pool & Withdraw",
      desc: "At room expiration, the entry fees pool is distributed to the top performers based on AI scores. Withdraw your winnings directly to your bank account immediately!"
    }
  ];

  return (
    <div className="min-h-[calc(100vh-8rem)] py-20 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center space-y-6 mb-16">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl font-extrabold tracking-tight"
          >
            How it <span className="text-gradient">Works</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-muted-foreground leading-relaxed"
          >
            Five simple steps to achieving your goals and winning the reward pool.
          </motion.p>
        </div>

        <div className="space-y-8 relative before:absolute before:inset-0 before:ml-12 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
          {steps.map((step, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active"
            >
              {/* Icon */}
              <div className="flex items-center justify-center w-24 h-24 rounded-full border-4 border-background glass bg-card shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-xl z-10">
                {step.icon}
              </div>
              
              {/* Content */}
              <div className="w-[calc(100%-7rem)] md:w-[calc(50%-3rem)] glass-card p-6 rounded-2xl">
                <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
