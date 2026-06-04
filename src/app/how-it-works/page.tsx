"use client";

import { motion } from "framer-motion";
import { PlusCircle, KeyRound, UploadCloud, Trophy, Wallet } from "lucide-react";

export default function HowItWorks() {
  const steps = [
    {
      icon: <Wallet className="w-8 h-8 text-indigo-400" />,
      title: "1. Create Your Account & Fund Your Wallet",
      desc: "Sign up for free and fund your MoveUp wallet. Your balance is used to pay the commitment fee when you join a challenge room."
    },
    {
      icon: <PlusCircle className="w-8 h-8 text-blue-400" />,
      title: "2. Create or Join a Room",
      desc: "Create a private room with a set duration and commitment fee amount, or join an existing one using a unique invite code. A commitment fee is charged to all participants upon joining."
    },
    {
      icon: <KeyRound className="w-8 h-8 text-purple-400" />,
      title: "3. Set Your Tasks",
      desc: "Once inside, create your private task list. These remain hidden from others until you complete them, keeping the competition fair."
    },
    {
      icon: <UploadCloud className="w-8 h-8 text-emerald-400" />,
      title: "4. Upload Proof",
      desc: "Finish a task? Mark it complete and upload text, image, or video proof. Everyone in the room will see it and your score goes up."
    },
    {
      icon: <Trophy className="w-8 h-8 text-amber-400" />,
      title: "5. Win the Pool",
      desc: "The first person to hit 100% completion wins the entire pooled commitment fees from all room participants. Your winnings go straight to your wallet."
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
