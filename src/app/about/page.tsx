"use client";

import { motion } from "framer-motion";
import { Users, Heart, Zap } from "lucide-react";

export default function AboutUs() {
  return (
    <div className="min-h-[calc(100vh-8rem)] py-20 px-4">
      <div className="max-w-4xl mx-auto space-y-16">
        {/* Header */}
        <div className="text-center space-y-6">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl font-extrabold tracking-tight"
          >
            About <span className="text-gradient">MoveUp</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto"
          >
            We believe that true productivity requires stakes. MoveUp was built to bring accountability back to goal setting through gamification and real financial commitment.
          </motion.p>
        </div>

        {/* Mission & Vision */}
        <div className="grid md:grid-cols-2 gap-8">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="glass-card p-10 rounded-3xl"
          >
            <div className="glass w-14 h-14 rounded-2xl flex items-center justify-center mb-6">
              <Zap className="text-yellow-500 w-7 h-7" />
            </div>
            <h2 className="text-2xl font-bold mb-4">Our Mission</h2>
            <p className="text-muted-foreground leading-relaxed">
              To eliminate procrastination by providing a platform where commitments carry real weight. By paying a commitment fee on your goals, you are financially and socially incentivized to follow through and win.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="glass-card p-10 rounded-3xl"
          >
            <div className="glass w-14 h-14 rounded-2xl flex items-center justify-center mb-6">
              <Users className="text-blue-500 w-7 h-7" />
            </div>
            <h2 className="text-2xl font-bold mb-4">The Community</h2>
            <p className="text-muted-foreground leading-relaxed">
              We thrive on friendly competition. MoveUp isn't just a todo list; it's a shared environment where you and your peers hold each other to the highest standards and share in each other's growth.
            </p>
          </motion.div>
        </div>

        {/* Story */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass border border-border/50 p-10 rounded-3xl text-center"
        >
          <div className="glass w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
            <Heart className="text-pink-500 w-8 h-8" />
          </div>
          <h2 className="text-3xl font-bold mb-6">Built with intention.</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            MoveUp started as an experiment between a few friends who were tired of breaking promises to themselves. We realized that putting a real financial stake on the line drastically increased our completion rate. Today, we're bringing that same powerful mechanic to everyone.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
