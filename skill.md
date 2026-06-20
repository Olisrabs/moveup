# MoveUp UI Design Skill — AI Prompt Reference

Read this file fully before writing any code. This is the complete design skill for recreating the MoveUp UI.

---

## STACK

- **Next.js App Router** + TypeScript
- **Tailwind CSS v4** (`@import "tailwindcss"` in globals.css, theme via `@theme inline {}`)
- **Framer Motion** — ALL animations, transitions, modals, entrance effects
- **Lucide React** — ALL icons
- **Google Font: Inter** via `next/font/google` → `Inter({ subsets: ["latin"] })`
- **No UI component library** (no shadcn, no MUI). Build everything from scratch.

---

## GLOBAL CSS — Copy Exactly

```css
@import "tailwindcss";

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-accent: var(--accent);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border);
  --color-card: var(--card);
  --font-sans: 'Inter', sans-serif;
  --radius-lg: var(--radius);
  --radius-md: calc(var(--radius) - 2px);
  --radius-sm: calc(var(--radius) - 4px);
}

:root {
  --background: #f8fafc;
  --foreground: #0f1115;
  --primary: #4f46e5;
  --primary-foreground: #ffffff;
  --secondary: #e2e8f0;
  --accent: #10b981;
  --muted: #f1f5f9;
  --muted-foreground: #64748b;
  --border: rgba(0,0,0,0.1);
  --card: rgba(255,255,255,0.9);
  --radius: 0.75rem;
}

.dark {
  --background: #0f1115;
  --foreground: #f8fafc;
  --primary: #6366f1;
  --primary-foreground: #ffffff;
  --secondary: #1e293b;
  --accent: #10b981;
  --muted: #334155;
  --muted-foreground: #94a3b8;
  --border: rgba(255,255,255,0.08);
  --card: rgba(15,17,21,0.85);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
  overflow-x: hidden;
  transition: background-color 0.3s ease, color 0.3s ease;
}

@utility glass {
  background: var(--card);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border);
}

@utility glass-card {
  background: var(--card);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--border);
  box-shadow: 0 4px 30px rgba(0,0,0,0.05);
}

.dark .glass-card {
  background: linear-gradient(145deg, rgba(30,41,59,0.4) 0%, rgba(15,17,21,0.2) 100%);
  box-shadow: 0 4px 30px rgba(0,0,0,0.1);
}

@utility text-gradient {
  background: linear-gradient(to right, var(--primary), #c084fc);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

---

## COLORS — Semantic Usage Rules

| Token | Light | Dark | When to use |
|---|---|---|---|
| `primary` | `#4f46e5` | `#6366f1` | CTAs, active nav, links, icons |
| `accent` | `#10b981` | same | Completed/success states |
| `border` | `rgba(0,0,0,0.1)` | `rgba(255,255,255,0.08)` | All borders |
| `card` | `rgba(255,255,255,0.9)` | `rgba(15,17,21,0.85)` | Card/modal backgrounds |
| `muted-foreground` | `#64748b` | `#94a3b8` | Secondary text, labels |
| `secondary` | `#e2e8f0` | `#1e293b` | Hover rows, sub-surfaces |

**Contextual tint pattern** — always use `/10` opacity for icon backgrounds:
- Primary: `bg-primary/10 text-primary`
- Success/accent: `bg-accent/10 text-accent`  
- Warning: `bg-orange-500/10 text-orange-500`
- Danger: `bg-red-500/10 text-red-500`
- Info: `bg-blue-500/10 text-blue-500`
- Amber: `bg-amber-500/10 text-amber-500`

---

## BORDER RADIUS — Use These Exactly

| Tailwind class | px | Used for |
|---|---|---|
| `rounded-lg` | 8px | Small icon action buttons (`p-2`) |
| `rounded-xl` | 12px | Inputs, nav items, small buttons, tag chips |
| `rounded-2xl` | 16px | Cards, list rows, stat blocks, table wrappers |
| `rounded-3xl` | 24px | Modals, hero sections, main feature cards |
| `rounded-full` | pill | Status badges, notification dots, avatar initials |

---

## GLASS UTILITIES — When to Use Each

- **`.glass`** → Navbar, floating elements, secondary panels, testimonial cards
- **`.glass-card`** → Dashboard cards, stat blocks, task cards, room cards, any main content card

Both require a translucent/blurred parent or page background to look correct.

---

## COMPONENT BLUEPRINTS

### Stat Card
```tsx
<motion.div className="glass-card rounded-2xl p-5 flex flex-col gap-3">
  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
    <Icon size={20} className="text-primary" />
  </div>
  <div>
    <p className="text-2xl font-bold">{value}</p>
    <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
  </div>
</motion.div>
```

### Gradient Hero Banner
```tsx
<div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary/90 to-purple-600 p-8 text-white">
  <div className="absolute -top-8 -right-8 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
  <div className="absolute -bottom-8 -left-4 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
  <div className="relative z-10">
    {/* content */}
  </div>
</div>
```
Rule: decorative blobs are `bg-white/5` to `bg-white/10`, `rounded-full blur-3xl`, positioned negative absolute.

### Modal
```tsx
<AnimatePresence>
  {open && (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={close}
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
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold">Title</h3>
            <button onClick={close} className="p-2 rounded-lg text-muted-foreground hover:text-foreground">
              <X size={18} />
            </button>
          </div>
          {/* body */}
        </div>
      </motion.div>
    </>
  )}
</AnimatePresence>
```

### Form Input
```tsx
// Reuse this class string as a constant
const inputClass = "w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all";
```

### Primary Button
```tsx
<button className="bg-primary text-primary-foreground font-semibold py-3 px-6 rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
  {loading ? <Loader2 size={18} className="animate-spin" /> : <>Label <ArrowRight size={18} /></>}
</button>
```

### CTA with Glow (landing)
```tsx
<button className="bg-primary text-primary-foreground px-8 py-4 rounded-xl font-bold text-lg hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all shadow-[0_0_40px_-10px_rgba(99,102,241,0.5)]">
```

### List Row (hover)
```tsx
<div className="flex items-center gap-3 bg-secondary/30 hover:bg-secondary/50 transition-colors rounded-xl px-4 py-3">
```

### Status Pill
```tsx
{/* Completed */}
<span className="text-xs px-2.5 py-1 rounded-full font-medium bg-accent/10 text-accent">completed</span>
{/* Pending */}
<span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500">pending</span>
{/* Amber */}
<span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 bg-amber-500/10 text-amber-500 rounded-full">
  <Clock size={12} /> Pending Review
</span>
```

### Icon Action Button (hover-revealed)
```tsx
{/* Parent must have `group` class */}
<div className="flex items-center gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
  <button className="p-2 rounded-lg text-muted-foreground hover:text-blue-400 hover:bg-blue-400/10 transition-all">
    <Pencil size={14} />
  </button>
  <button className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-all">
    <Trash2 size={14} />
  </button>
</div>
```

### Error / Alert Banners
```tsx
{/* Error */}
<div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-xl text-sm">
  <AlertCircle size={16} className="shrink-0 mt-0.5" /><span>{msg}</span>
</div>
{/* Success */}
<div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 p-4 rounded-2xl text-sm flex items-center gap-2">
  <CheckCircle2 size={18} /><span>{msg}</span>
</div>
{/* Loading info */}
<div className="bg-primary/10 border border-primary/20 text-primary px-4 py-3 rounded-2xl text-sm flex items-center gap-2">
  <Loader2 size={16} className="animate-spin" /><span>{msg}</span>
</div>
```

### Skeleton Loader
```tsx
<div className="h-20 rounded-2xl bg-card animate-pulse border border-border" />
<div className="h-16 rounded-xl bg-secondary/50 animate-pulse" />
```

### Avatar Initial
```tsx
<div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
  {name[0].toUpperCase()}
</div>
```

### Feature Card (Landing)
```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true }}
  className="glass-card p-8 rounded-3xl"
>
  <div className="glass w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
    <Icon className="text-emerald-500 w-8 h-8" />
  </div>
  <h3 className="text-xl font-bold mb-3">{title}</h3>
  <p className="text-muted-foreground leading-relaxed">{desc}</p>
</motion.div>
```

### Quick Action Card
```tsx
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

---

## ANIMATION RULES

**Always use Framer Motion. Never raw CSS keyframes for component entrance.**

```tsx
// Standard card entrance
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}

// Stagger children
const container = { hidden:{opacity:0}, visible:{opacity:1,transition:{staggerChildren:0.15}} }
const item = { hidden:{opacity:0,y:20}, visible:{opacity:1,y:0,transition:{duration:0.5,ease:"easeOut"}} }

// Scroll-triggered (whileInView)
whileInView={{ opacity: 1, y: 0 }}
viewport={{ once: true }}

// Custom delay (stat cards)
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.4 } })
}
// <motion.div custom={i} variants={fadeUp} initial="hidden" animate="show" />

// Modal
initial={{ opacity:0, scale:0.95, y:20 }}
animate={{ opacity:1, scale:1, y:0 }}
exit={{ opacity:0, scale:0.95, y:20 }}

// Mobile drawer
initial={{ x:"-100%" }} animate={{ x:0 }} exit={{ x:"-100%" }}
transition={{ type:"spring", bounce:0, duration:0.35 }}

// Sidebar active pill (shared layout animation)
<motion.div layoutId="sidebar-active" className="absolute inset-0 bg-primary rounded-xl"
  transition={{ type:"spring", bounce:0.2, duration:0.4 }} />

// Notification badge pop
initial={{ scale:0 }} animate={{ scale:1 }} exit={{ scale:0 }}

// Logo hover spin
whileHover={{ rotate: 180 }} transition={{ duration: 0.3 }}
```

---

## NAVIGATION PATTERNS

### Floating Public Navbar
```tsx
<nav className="fixed top-0 left-0 right-0 z-50 p-4">
  <div className="mx-auto max-w-5xl glass rounded-2xl px-6 py-3 flex items-center justify-between shadow-lg">
    {/* logo | links | actions */}
  </div>
</nav>
```
The `p-4` creates the floating effect — the inner glass pill appears to float.

### Dashboard Sidebar
```tsx
<aside className="hidden lg:flex flex-col w-64 h-screen fixed left-0 top-0 border-r border-border bg-card/50 backdrop-blur-xl z-40">
  {/* p-6 border-b: logo */}
  {/* flex-1 p-4 space-y-1 overflow-y-auto: nav links */}
  {/* p-4 border-t: user section */}
</aside>
```
Active item: `bg-primary text-primary-foreground shadow-lg shadow-primary/20` + layoutId spring pill.
Inactive item: `text-muted-foreground hover:text-foreground hover:bg-secondary/50`.

### Dashboard Topbar
```tsx
<header className="lg:pl-64 fixed top-0 left-0 right-0 z-30 border-b border-border bg-background/95 backdrop-blur-2xl">
  <div className="flex items-center justify-between px-4 sm:px-6 h-16">
```
Height is always `h-16`. Left-padded `lg:pl-64` to clear the sidebar.

### Dashboard Layout Shell
```tsx
<div className="min-h-screen bg-background">
  <Sidebar /> {/* w-64 fixed */}
  <Topbar /> {/* h-16 fixed */}
  <main className="lg:pl-64 pt-16 min-h-screen">
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {children}
    </div>
  </main>
</div>
```

---

## TYPOGRAPHY SCALE

| Role | Classes |
|---|---|
| Landing H1 | `text-5xl md:text-7xl font-extrabold tracking-tight` |
| Section H2 | `text-3xl md:text-5xl font-bold` |
| Page heading | `text-2xl font-bold` |
| Card / modal title | `text-lg font-bold` |
| Sub-section label | `font-semibold text-base` or `font-semibold text-sm` |
| Body | `text-sm` |
| Caption / meta | `text-xs text-muted-foreground` |
| Tiny detail | `text-[10px] text-muted-foreground` |
| Gradient hero word | `<span className="text-gradient">` (custom utility) |

---

## SPACING CHEAT SHEET

| Context | Value |
|---|---|
| Dashboard page root | `space-y-6` or `space-y-8` |
| Sections inside a page | `space-y-4` |
| Card inner padding (compact) | `p-5` |
| Card inner padding (standard) | `p-6` |
| Modal inner padding | `p-7` |
| Hero / feature card | `p-8` |
| Nav item | `px-4 py-3` |
| Input | `px-4 py-2.5` |
| Badge / pill | `px-2.5 py-1` or `px-2 py-0.5` |
| Grid gap (stats) | `gap-4` |
| Grid gap (cards) | `gap-6` |

---

## GRID PATTERNS

```tsx
// Stats row (2 mobile → 4 desktop)
<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

// Two-column content
<div className="grid lg:grid-cols-2 gap-6">

// Feature cards
<div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">

// Quick actions
<div className="grid sm:grid-cols-3 gap-4">
```

---

## THEME TOGGLE IMPLEMENTATION

```tsx
// In <head> before hydration (flash prevention)
<script dangerouslySetInnerHTML={{ __html: `
  try {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (_) {}
` }} />

// ThemeToggle component
const toggleTheme = () => {
  const root = document.documentElement;
  if (isDark) { root.classList.remove('dark'); localStorage.setItem('theme','light'); }
  else { root.classList.add('dark'); localStorage.setItem('theme','dark'); }
  setIsDark(!isDark);
};

// Button
<button className="p-2 rounded-xl glass hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground">
  <motion.div animate={{ rotate: isDark ? 0 : 180 }} transition={{ duration: 0.3 }}>
    {isDark ? <Sun size={20} /> : <Moon size={20} />}
  </motion.div>
</button>
```

---

## LIVE PULSE DOT (Hero Badge)

```tsx
<span className="relative flex h-2 w-2">
  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
</span>
```

---

## HERO BADGE (Landing)

```tsx
<div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-primary/30 text-sm font-medium text-primary">
  <LivePulseDot />
  Tagline text
</div>
```

---

## AUTH PAGE LAYOUT

```tsx
<div className="min-h-[calc(100vh-8rem)] flex flex-col justify-center items-center px-4 py-12">
  <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="w-full max-w-md">
    {/* Logo icon */}
    <div className="text-center mb-8">
      <div className="inline-flex bg-primary text-primary-foreground p-3 rounded-2xl mb-4 shadow-lg shadow-primary/20">
        <Logo size={32} />
      </div>
      <h1 className="text-3xl font-bold tracking-tight">Page Title</h1>
      <p className="text-muted-foreground mt-2">Subtitle</p>
    </div>
    {/* Form card */}
    <div className="glass-card p-8 rounded-3xl">
      {/* form content */}
    </div>
  </motion.div>
</div>
```

---

## ADMIN / DANGER ZONE PANEL

```tsx
<div className="border border-red-500/20 bg-red-500/[0.02] rounded-3xl p-6 space-y-4">
  <h3 className="font-bold text-red-500 flex items-center gap-2">
    <ShieldAlert size={18} /> Admin Panel Title
  </h3>
  {/* content */}
</div>
```

---

## SECTION DIVIDER

```tsx
<section className="py-24 border-t border-border/50">
```
Note the `/50` opacity on `border-border` — subtle, not a hard line.

---

## COMPLETE DESIGN PRINCIPLES SUMMARY

1. **Glassmorphism**: Use `.glass` and `.glass-card` utilities. Never a flat opaque background for cards.
2. **Always animate**: Every component mount uses `initial/animate`. Every list uses `AnimatePresence`. Every modal uses scale+opacity+y entrance.
3. **Indigo primary, Emerald accent**: No other colors as "brand" colors. Other colors only for semantic states.
4. **Tinted icon containers**: Icons always sit inside a tinted container `w-10 h-10 rounded-xl bg-{color}/10`.
5. **`rounded-3xl` for big things, `rounded-xl` for small things**: Never `rounded-md` or `rounded-sm` on visible UI.
6. **Hover-revealed actions**: Action buttons on cards are `lg:opacity-0 lg:group-hover:opacity-100` — invisible until hover on desktop.
7. **`space-y-*` for vertical layout**: Dashboard pages use `space-y-6` or `space-y-8` as root.
8. **Dark mode first**: Design dark first. Light is a clean inversion.
9. **Framer Motion always**: No CSS transitions for entrance/exit of entire components.
10. **Inter font**: No other typeface. Font smoothing via `antialiased`.
