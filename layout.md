# MoveUp — Complete UI Design Reference

> This document is the single source of truth for every visual and structural decision made in the MoveUp project. Use it to faithfully recreate the design system in any new project.

---

## 1. Tech Stack (UI-Only)

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js (App Router) | `"use client"` for interactive pages |
| Styling | Tailwind CSS v4 (`@import "tailwindcss"`) | Custom theme via `@theme inline {}` |
| Font | **Inter** (Google Fonts) | `subset: ["latin"]`, applied globally |
| Animation | **Framer Motion** | All transitions, page entrance, modals |
| Icons | **Lucide React** | Consistent icon library throughout |
| Theme | Dark/Light toggle | Persisted in `localStorage`, applied via `.dark` class on `<html>` |

---

## 2. Design Philosophy

- **Glassmorphism-first**: All cards and navigation surfaces use `backdrop-filter: blur()` with translucent backgrounds.
- **Dark mode as default**: UI is designed dark-first; light mode is a clean inversion.
- **Motion everywhere**: Every state change, mount, and hover uses Framer Motion. Nothing is abrupt.
- **Indigo + Emerald palette**: Primary = Indigo, Accent = Emerald Green. Used consistently across all status indicators.
- **Rounded, soft surfaces**: Everything uses large border-radius. Nothing is sharp.

---

## 3. Color Tokens

All colors are defined as CSS custom properties in `:root` (light) and `.dark`.

### Light Mode
```css
:root {
  --background:        #f8fafc;           /* Slate 50 — page background */
  --foreground:        #0f1115;           /* Near-black — all text */
  --primary:           #4f46e5;           /* Indigo 600 — CTAs, active states */
  --primary-foreground:#ffffff;           /* White — text on primary */
  --secondary:         #e2e8f0;           /* Slate 200 — secondary surfaces */
  --accent:            #10b981;           /* Emerald 500 — success, completed */
  --muted:             #f1f5f9;           /* Slate 100 — muted backgrounds */
  --muted-foreground:  #64748b;           /* Slate 500 — secondary text */
  --border:            rgba(0,0,0,0.1);   /* Subtle dark border */
  --card:              rgba(255,255,255,0.9); /* Semi-transparent white card */
  --radius:            0.75rem;           /* 12px — base border-radius */
}
```

### Dark Mode
```css
.dark {
  --background:        #0f1115;
  --foreground:        #f8fafc;
  --primary:           #6366f1;           /* Indigo 500 — slightly lighter for dark */
  --secondary:         #1e293b;           /* Slate 800 */
  --accent:            #10b981;           /* Same emerald */
  --muted:             #334155;           /* Slate 700 */
  --muted-foreground:  #94a3b8;           /* Slate 400 */
  --border:            rgba(255,255,255,0.08);
  --card:              rgba(15,17,21,0.85);
}
```

### Semantic Color Usage (Tailwind Classes)
| Semantic | Class Pattern | Example |
|---|---|---|
| Primary action | `bg-primary text-primary-foreground` | Buttons, active nav |
| Accent/success | `text-accent bg-accent/10` | Completed task badge |
| Pending/warning | `text-orange-500 bg-orange-500/10` | Pending tasks |
| Destructive | `text-red-500 bg-red-500/10` | Delete, error states |
| Informational | `text-blue-500 bg-blue-500/10` | Info badges |
| Muted text | `text-muted-foreground` | Labels, captions |
| Muted surface | `bg-secondary/30`, `bg-secondary/50` | Hover rows, sub-cards |

---

## 4. Typography

| Role | Classes | Description |
|---|---|---|
| Page heading | `text-2xl font-bold` | Section titles inside dashboard pages |
| Sub-heading | `text-lg font-bold` or `font-semibold text-base` | Card titles, modal titles |
| Body | `text-sm` | Default content |
| Caption / label | `text-xs text-muted-foreground` | Timestamps, meta, form labels |
| Hero heading | `text-5xl md:text-7xl font-extrabold tracking-tight` | Landing page H1 |
| Gradient text | `text-gradient` custom utility | Highlighted hero words |
| Logo text | `font-bold text-xl tracking-tight` | Brand wordmark |

```css
/* Gradient text utility */
@utility text-gradient {
  background: linear-gradient(to right, var(--primary), #c084fc);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

---

## 5. Border Radius Scale

```css
--radius:    0.75rem   /* 12px  — base */
--radius-md: 0.625rem  /* 10px  = radius - 2px */
--radius-sm: 0.5rem    /* 8px   = radius - 4px */
```

| Class | Usage |
|---|---|
| `rounded-xl` (12px) | Inputs, small buttons, icon containers, nav items |
| `rounded-2xl` (16px) | Cards, list rows, stat blocks, table containers |
| `rounded-3xl` (24px) | Modals, hero banners, feature cards, main glass panels |
| `rounded-full` | Pills/badges, notification dots, avatar initials |
| `rounded-lg` | Small action buttons (p-2) |

---

## 6. Spacing System

| Pattern | Value | Usage |
|---|---|---|
| `p-4` | 16px | Mobile dashboard content padding |
| `p-5` | 20px | Card inner padding (compact) |
| `p-6` | 24px | Card inner padding (standard) |
| `p-7` | 28px | Modal inner padding |
| `p-8` | 32px | Hero sections, feature cards |
| `gap-3` | 12px | Default flex gap inside nav/header |
| `gap-4` | 16px | Grid gap, form field gap |
| `gap-6` | 24px | Section-to-section gap |
| `gap-8` | 32px | Large section gaps |
| `space-y-1` | 4px | Tight vertical stacks (nav items) |
| `space-y-4` | 16px | Form field vertical spacing |
| `space-y-6` | 24px | Dashboard page section spacing |
| `space-y-8` | 32px | Dashboard overview major sections |

---

## 7. Custom Utility Classes

Defined in `globals.css` using `@utility`:

### `.glass`
```css
@utility glass {
  background: var(--card);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border);
}
```
**Used for:** Navbar, floating panels, secondary surfaces.

### `.glass-card`
```css
@utility glass-card {
  background: var(--card);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--border);
  box-shadow: 0 4px 30px rgba(0,0,0,0.05);
}

/* Dark-mode override */
.dark .glass-card {
  background: linear-gradient(145deg, rgba(30,41,59,0.4) 0%, rgba(15,17,21,0.2) 100%);
  box-shadow: 0 4px 30px rgba(0,0,0,0.1);
}
```
**Used for:** All dashboard cards, stat blocks, task cards, room cards.

---

## 8. Shadows

| Class | Usage |
|---|---|
| `shadow-lg shadow-primary/20` | Primary CTA buttons |
| `shadow-2xl` | Modals |
| `0 4px 30px rgba(0,0,0,0.05)` | `.glass-card` base shadow |
| `shadow-[0_0_40px_-10px_rgba(99,102,241,0.5)]` | Hero CTA glow effect |

---

## 9. Borders

- Default border: `border border-border` (1px, `var(--border)`)
- Colored contextual borders: `border-primary/30`, `border-red-500/20`, `border-amber-500/20`
- Dividers inside lists: `divide-y divide-border`
- Section dividers: `border-t border-border`, `border-b border-border`

---

## 10. Component Patterns

### 10.1 Stat Card
```jsx
<div className="glass-card rounded-2xl p-5 flex flex-col gap-3">
  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
    <Icon size={20} className="text-primary" />
  </div>
  <div>
    <p className="text-2xl font-bold">{value}</p>
    <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
  </div>
</div>
```
- Icon container: `w-10 h-10 rounded-xl` with tinted background (`bg-{color}/10`)
- Value: `text-2xl font-bold`
- Label: `text-xs text-muted-foreground`

### 10.2 Hero Banner (Gradient)
```jsx
<div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary/90 to-purple-600 p-8 text-white">
  {/* Decorative blobs */}
  <div className="absolute -top-8 -right-8 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
  <div className="absolute -bottom-8 -left-4 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
  <div className="relative z-10">
    {/* Content */}
  </div>
</div>
```
- Gradient: `from-primary via-primary/90 to-purple-600`
- Decorative blobs: white at 5-10% opacity, `rounded-full blur-3xl`
- All content inside `relative z-10`

### 10.3 List Row (Hover)
```jsx
<div className="flex items-center gap-3 bg-secondary/30 hover:bg-secondary/50 transition-colors rounded-xl px-4 py-3">
  {/* content */}
</div>
```

### 10.4 Status Badge / Pill
```jsx
<span className="text-xs px-2.5 py-1 rounded-full font-medium bg-accent/10 text-accent">
  completed
</span>
<span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500">
  pending
</span>
```

### 10.5 Feature Card (Landing)
```jsx
<div className="glass-card p-8 rounded-3xl">
  <div className="glass w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
    <Icon className="text-emerald-500 w-8 h-8" />
  </div>
  <h3 className="text-xl font-bold mb-3">{title}</h3>
  <p className="text-muted-foreground leading-relaxed">{desc}</p>
</div>
```

### 10.6 Modal
```jsx
{/* Backdrop */}
<motion.div
  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
  onClick={closeModal}
  className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
/>
{/* Panel */}
<motion.div
  initial={{ opacity: 0, scale: 0.95, y: 20 }}
  animate={{ opacity: 1, scale: 1, y: 0 }}
  exit={{ opacity: 0, scale: 0.95, y: 20 }}
  className="fixed inset-0 z-50 flex items-center justify-center p-4"
>
  <div className="bg-card border border-border rounded-3xl p-7 w-full max-w-md shadow-2xl">
    {/* Modal header */}
    <div className="flex items-center justify-between mb-6">
      <h3 className="text-lg font-bold">Modal Title</h3>
      <button onClick={closeModal} className="p-2 rounded-lg text-muted-foreground hover:text-foreground">
        <X size={18} />
      </button>
    </div>
    {/* Content */}
  </div>
</motion.div>
```
- Backdrop: `bg-black/60 backdrop-blur-sm`
- Panel: `bg-card border border-border rounded-3xl p-7 max-w-md shadow-2xl`
- Enter: `opacity + scale(0.95) + y(20)` → normal

### 10.7 Form Input
```css
.input {
  @apply w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm;
  @apply focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all;
}
```
- Border: `border-border`
- Focus ring: `focus:ring-2 focus:ring-primary/50`
- Border-radius: `rounded-xl`

### 10.8 Primary Button
```jsx
<button className="bg-primary text-primary-foreground px-8 py-4 rounded-xl font-bold text-lg hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_-10px_rgba(99,102,241,0.5)]">
  CTA Label
</button>
```
- Hover: `opacity 90% + scale(1.05)`
- Active: `scale(0.95)`
- Disabled: `opacity-70 cursor-not-allowed`

### 10.9 Secondary / Ghost Button
```jsx
<button className="px-8 py-4 rounded-xl font-bold glass hover:bg-white/5 transition-all">
  Secondary
</button>
```

### 10.10 Icon Action Button (on-hover)
```jsx
<div className="flex items-center gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
  <button className="p-2 rounded-lg text-muted-foreground hover:text-blue-400 hover:bg-blue-400/10 transition-all">
    <Pencil size={14} />
  </button>
</div>
```
- Container parent needs `group` class
- Default: `opacity-0` on desktop, visible on mobile
- Hover reveal: `lg:group-hover:opacity-100`

### 10.11 Error / Alert Banner
```jsx
{/* Error */}
<div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-xl text-sm">
  <AlertCircle size={16} className="shrink-0 mt-0.5" />
  <span>{message}</span>
</div>

{/* Success */}
<div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 p-4 rounded-2xl text-sm">
  <CheckCircle2 size={18} />
  <span>{message}</span>
</div>

{/* Info */}
<div className="bg-primary/10 border border-primary/20 text-primary px-4 py-3 rounded-2xl text-sm flex items-center gap-2">
  <Loader2 size={16} className="animate-spin" />
  <span>{message}</span>
</div>
```

### 10.12 Skeleton Loader (Pulse)
```jsx
<div className="h-20 rounded-2xl bg-card animate-pulse border border-border" />
<div className="h-16 rounded-xl bg-secondary/50 animate-pulse" />
```

### 10.13 Avatar Initial
```jsx
<div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
  {name[0].toUpperCase()}
</div>
```

### 10.14 Wallet Balance Chip (in nav)
```jsx
<div className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm font-medium">
  <Wallet size={14} />
  <span>₦1,200.00</span>
</div>
```

---

## 11. Navigation

### 11.1 Public Navbar (Floating Glass)
```jsx
<nav className="fixed top-0 left-0 right-0 z-50 p-4">
  <div className="mx-auto max-w-5xl glass rounded-2xl px-6 py-3 flex items-center justify-between shadow-lg">
    {/* Logo | Links | Actions */}
  </div>
</nav>
```
- **Floats above content** with `p-4` — the rounded pill sits in the center
- Links: `text-sm font-medium hover:text-primary transition-colors`
- Active link: `text-primary`
- Inactive: `text-muted-foreground`

### 11.2 Dashboard Sidebar (Desktop)
```jsx
<aside className="hidden lg:flex flex-col w-64 h-screen fixed left-0 top-0 border-r border-border bg-card/50 backdrop-blur-xl z-40">
```
- Width: `w-64` (256px), fixed
- Hidden on mobile (`hidden lg:flex`)
- Backdrop: `bg-card/50 backdrop-blur-xl`

**Nav Item (Active)**
```jsx
<Link className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium bg-primary text-primary-foreground shadow-lg shadow-primary/20 relative">
  {/* Framer Motion layoutId="sidebar-active" for sliding pill */}
  <motion.div layoutId="sidebar-active" className="absolute inset-0 bg-primary rounded-xl" transition={{ type:"spring", bounce:0.2 }} />
  <Icon size={18} className="relative z-10" />
  <span className="relative z-10">Label</span>
  <ChevronRight size={14} className="ml-auto relative z-10 opacity-70" />
</Link>
```

**Nav Item (Inactive)**
```jsx
<Link className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all">
```

### 11.3 Dashboard Topbar
```jsx
<header className="lg:pl-64 fixed top-0 left-0 right-0 z-30 border-b border-border bg-background/95 backdrop-blur-2xl">
  <div className="flex items-center justify-between px-4 sm:px-6 h-16">
    {/* Hamburger (mobile) | Page title */}
    {/* ThemeToggle | Bell with badge | Avatar */}
  </div>
</header>
```
- Height: `h-16` (64px)
- Left offset on desktop: `lg:pl-64`
- Background: `bg-background/95 backdrop-blur-2xl`

**Notification Badge**
```jsx
<motion.span
  initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
  className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1"
>
  {count}
</motion.span>
```

### 11.4 Mobile Drawer
```jsx
<motion.aside
  initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
  transition={{ type:"spring", bounce:0, duration:0.35 }}
  className="fixed left-0 top-0 bottom-0 w-72 bg-card border-r border-border z-50 flex flex-col"
>
```

---

## 12. Dashboard Layout Structure

```
<html .dark>
  <body>
    <aside w-64 fixed>    ← Sidebar (desktop only)
    <header lg:pl-64 h-16 fixed> ← Topbar
    <main lg:pl-64 pt-16>
      <div p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto>
        {children}
      </div>
    </main>
  </body>
</html>
```

---

## 13. Animation Patterns

All animations use **Framer Motion**. No CSS keyframe animations for component entrance.

### Standard Card Entrance
```js
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
```

### Stagger Children
```js
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
};
```

### Custom Delay (Stat cards)
```js
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.4 } })
};
// Usage: <motion.div custom={index} variants={fadeUp} />
```

### Scroll-triggered (Features, FAQ)
```jsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true }}
  transition={{ delay: i * 0.2 }}
>
```

### Logo hover spin
```jsx
<motion.div whileHover={{ rotate: 180 }} transition={{ duration: 0.3 }}>
  <Logo />
</motion.div>
```

### Theme toggle icon flip
```jsx
<motion.div
  animate={{ rotate: isDark ? 0 : 180 }}
  transition={{ duration: 0.3 }}
>
```

### Modal entrance
```jsx
initial={{ opacity: 0, scale: 0.95, y: 20 }}
animate={{ opacity: 1, scale: 1, y: 0 }}
exit={{ opacity: 0, scale: 0.95, y: 20 }}
```

### Notification badge pop
```jsx
initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
```

### Mobile drawer slide
```jsx
initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
transition={{ type: "spring", bounce: 0, duration: 0.35 }}
```

### Live pulse dot (hero badge)
```jsx
<span className="relative flex h-2 w-2">
  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
</span>
```

---

## 14. Landing Page Sections

### Hero Badge
```jsx
<div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-primary/30 text-sm font-medium text-primary">
  {/* Live pulse dot */}
  Accountability, Gamified.
</div>
```

### CTA Button Pair
```jsx
{/* Primary */}
<Link className="bg-primary text-primary-foreground px-8 py-4 rounded-xl font-bold text-lg hover:scale-105 active:scale-95 shadow-[0_0_40px_-10px_rgba(99,102,241,0.5)]">
  Get Started Free <ArrowRight />
</Link>
{/* Secondary */}
<Link className="px-8 py-4 rounded-xl font-bold glass hover:bg-white/5">
  How it works
</Link>
```

### Section Dividers
```jsx
<section className="py-24 border-t border-border/50">
```

### Testimonial Card
```jsx
<div className="glass p-8 rounded-3xl relative">
  <div className="absolute top-4 left-6 text-6xl text-primary/20 font-serif">"</div>
  <p className="text-lg mb-6 relative z-10 italic">"{quote}"</p>
  <h4 className="font-bold">{author}</h4>
  <span className="text-sm text-muted-foreground">{role}</span>
</div>
```

---

## 15. Footer

```jsx
<footer className="bg-card/50 border-t border-border mt-20 py-12">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
      {/* Brand col (md:col-span-1) | Platform | Legal | Connect */}
    </div>
    <div className="border-t border-border mt-12 pt-8 text-center text-sm text-muted-foreground">
      © {year} Brand. All rights reserved.
    </div>
  </div>
</footer>
```
- Link hover: `hover:text-primary transition-colors`
- Column header: `font-semibold mb-4`
- Links: `text-sm text-muted-foreground`

---

## 16. ThemeToggle Component

```jsx
<button className="p-2 rounded-xl glass hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground">
  <motion.div animate={{ rotate: isDark ? 0 : 180 }} transition={{ duration: 0.3 }}>
    {isDark ? <Sun size={20} /> : <Moon size={20} />}
  </motion.div>
</button>
```
- Persisted: `localStorage.setItem("theme", "dark"|"light")`
- Applied: `document.documentElement.classList.add/remove("dark")`
- Flash prevention: inline `<script>` in `<head>` before hydration

---

## 17. Role Badge (Sidebar)

```jsx
<div className={cn(
  "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold",
  isSuperAdmin ? "bg-amber-500/20 text-amber-400" :
  isPartner    ? "bg-purple-500/20 text-purple-400" :
                 "bg-blue-500/20 text-blue-400"
)}>
  {/* Icon */}
  {label}
</div>
```

---

## 18. Quick Actions Card

```jsx
<Link className="glass-card rounded-2xl p-5 flex items-start gap-4 hover:border-primary/40 transition-all group">
  <div className="bg-primary/10 text-primary p-2.5 rounded-xl group-hover:bg-primary group-hover:text-primary-foreground transition-all">
    <Icon size={18} />
  </div>
  <div>
    <p className="text-sm font-semibold">{label}</p>
    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
  </div>
</Link>
```
- Icon changes from tinted → filled on hover using `group-hover`

---

## 19. External Dependencies

| Package | Version (check package.json) | Purpose |
|---|---|---|
| `next` | Latest | Framework |
| `framer-motion` | Latest | All animations |
| `lucide-react` | Latest | All icons |
| `tailwindcss` | v4 | Utility CSS |
| `@next/third-parties` | Latest | Google Analytics |

**Google Font CDN** (loaded via `next/font/google`):
```js
import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"] });
```

**No additional component library** (no shadcn, no MUI, no Chakra).

---

## 20. Grid Layout Patterns

| Pattern | Classes |
|---|---|
| Dashboard 2-column | `grid lg:grid-cols-2 gap-6` |
| Stats row | `grid grid-cols-2 lg:grid-cols-4 gap-4` |
| Footer | `grid grid-cols-1 md:grid-cols-4 gap-8` |
| Feature cards | `grid md:grid-cols-3 gap-8 max-w-5xl mx-auto` |
| Quick actions | `grid sm:grid-cols-3 gap-4` |
| Testimonials | `grid md:grid-cols-2 gap-8` |

---

## 21. Page-Level Wrapper Conventions

| Context | Wrapper Classes |
|---|---|
| Dashboard page | `<div className="space-y-6">` or `space-y-8` |
| Centered auth page | `<div className="min-h-[calc(100vh-8rem)] flex flex-col justify-center items-center px-4 py-12">` |
| Public landing | `<div className="flex flex-col min-h-[calc(100vh-8rem)]">` |
| Section | `<section className="py-24">` |
