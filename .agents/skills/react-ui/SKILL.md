---
name: react-ui
description: Comprehensive guide for designing and developing modern React UI components. Use when creating, modifying, refactoring, or reviewing React user interfaces, design systems, component architecture, styling with Tailwind CSS, micro-interactions, responsive layouts, and accessibility (a11y).
---

# React UI & Component Design Skill

This skill guides the design, implementation, and refinement of modern, accessible, and high-craft React user interfaces. Follow these principles and patterns to ensure high aesthetic quality, robust accessibility, and clean component architecture.

---

## 1. UI Craft & Visual Polish ("Anti-AI Slop")

Avoid generic, default, or unrefined UI outputs. Every interface should feel intentional, tactile, and aligned with modern product standards:

* **Spacing & Rhythm**:
  * Adhere to a strict 4px / 8px scale (`gap-1.5`, `gap-2`, `gap-3`, `gap-4`, `gap-6`, `p-4`, `p-6`).
  * Group related elements tightly (`gap-1.5` or `gap-2`), while giving distinct sections breathing room (`mb-6` or `gap-6`).
  * Avoid claustrophobic cards: give interactive surfaces comfortable internal padding (minimum `p-4` or `p-6` for cards).

* **Typography & Hierarchy**:
  * Limit font weights to 2–3 per view (e.g. Regular 400 for body, Medium 500 for interactive elements/labels, Semibold 600 for headings).
  * Use optical sizing: pair larger headings (`text-xl`, `text-2xl`) with tighter tracking (`tracking-tight`).
  * Never use sub-12px microtext (`text-[10px]` or `text-[11px]`). Use `text-xs` (12px) as the absolute floor for metadata, badges, and captions.
  * Contrast hierarchy: High-contrast primary text (`text-slate-900` / `text-white`), muted secondary text (`text-slate-500` / `text-zinc-400`), subtle tertiary borders/icons.

* **Surfaces, Elevation & Borders**:
  * Prefer crisp, subtle borders over muddy drop shadows: `border border-slate-200/80 dark:border-zinc-800`.
  * When using shadows, keep them soft and layered: `shadow-sm` or `shadow-[0_1px_3px_rgba(0,0,0,0.05)]`.
  * Use subtle translucent backdrops for floating panels, navbars, and dialog overlays (`bg-white/80 backdrop-blur-md dark:bg-zinc-900/80`).

* **Interactive States & Transitions**:
  * Every interactive element must provide feedback across all states: `hover`, `active`, `focus-visible`, and `disabled`.
  * Always implement visible focus rings for keyboard users: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2`.
  * Add quick, responsive transitions: `transition-all duration-150 ease-out` (avoid slow >300ms transitions for micro-interactions).
  * Disabled states: Reduce opacity (`disabled:opacity-50`) and change cursor (`disabled:pointer-events-none` or `disabled:cursor-not-allowed`).

---

## 2. Component Architecture & Principles

### A. The `cn()` Class Merging Utility
Always compose Tailwind classes dynamically using `clsx` and `tailwind-merge` to allow callers to override styles without specificity conflicts:

```typescript
// src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### B. Compound Components over Prop Bloat
When building complex UI widgets (modals, dropdowns, accordions, tabs), avoid passing 20 boolean flags and callback props to a single monolithic component. Instead, expose composable compound subcomponents:

```tsx
// Good: Composable, clear slot boundaries
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogTrigger asChild>
    <Button variant="outline">Open Settings</Button>
  </DialogTrigger>
  <DialogContent title="Account Settings">
    <DialogBody>...</DialogBody>
    <DialogFooter>
      <Button onClick={() => setIsOpen(false)}>Save</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### C. Variant-Driven Components (CVA Pattern)
Use variant mapping for buttons, badges, alerts, and inputs:

```tsx
import React from 'react';
import { cn } from '../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

const variantStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-500 active:bg-indigo-700 shadow-sm',
  secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700',
  outline: 'border border-slate-300 bg-transparent text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white',
  destructive: 'bg-red-600 text-white hover:bg-red-500 active:bg-red-700 shadow-sm',
};

const sizeStyles: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-8 px-3 text-xs rounded-md gap-1.5',
  md: 'h-9 px-4 text-sm rounded-lg gap-2',
  lg: 'h-11 px-6 text-base rounded-lg gap-2.5',
  icon: 'h-9 w-9 p-0 rounded-lg justify-center',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50 select-none',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
```

---

## 3. Accessibility (a11y) Standards

Never compromise on accessible UI interactions:

1. **Semantic HTML First**:
   * Use `<button>` for actions, `<a>` for navigation.
   * Use `<header>`, `<main>`, `<nav>`, `<aside>`, and `<section>` for layout landmarks.
   * Use proper form labels paired with inputs (`<label htmlFor="id">` or `aria-labelledby`).

2. **Keyboard Navigation & Trapping**:
   * Modals and dropdowns must trap focus while open and restore focus to the trigger element when closed.
   * Modals must close on `Escape` key press.
   * Tabs, menus, and radiogroups should support arrow key navigation (`ArrowUp`/`ArrowDown` or `ArrowLeft`/`ArrowRight`).

3. **Screen Reader Context**:
   * Icon-only buttons MUST have `aria-label` (e.g. `<button aria-label="Close modal"><X className="w-4 h-4" /></button>`).
   * Decorative icons must have `aria-hidden="true"`.
   * Dynamic loading spinners should include an accessible announcement: `<span className="sr-only">Loading...</span>`.

---

## 4. UI State Handling (The 5 States of Every View)

For any view or component consuming asynchronous data, always explicitly design and implement all 5 states:

1. **Blank / Initial State**: Clean onboarding or invitation to action.
2. **Loading State**: Content-shaped animated skeletons (`animate-pulse bg-slate-200 dark:bg-zinc-800 rounded`), never a solitary spinner in a vast blank space.
3. **Data / Ideal State**: The refined, populated view with proper typographic hierarchy and spacing.
4. **Empty State**: Friendly illustration or icon, explanatory heading, and a clear call-to-action button.
5. **Error State**: Non-destructive notification with clear error details and an immediate retry action.

---

## 5. React UI Execution Checklist

When authoring or modifying React components, verify:
- [ ] Uses `cn(...)` utility for class merging.
- [ ] Responsive design tested across mobile (`sm`), tablet (`md`), and desktop (`lg`/`xl`).
- [ ] All interactive elements feature `hover`, `active`, `focus-visible`, and `disabled` states.
- [ ] Semantic HTML and necessary `aria-*` tags are present.
- [ ] Loading skeletons and empty states are gracefully handled.
- [ ] Colors use consistent palette tokens or dark mode variants (`dark:...`).
- [ ] No hardcoded layout magic numbers that break with varying text lengths or translations.
