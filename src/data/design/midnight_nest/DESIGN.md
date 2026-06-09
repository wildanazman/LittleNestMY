---
name: Midnight Nest
colors:
  surface: '#121416'
  surface-dim: '#121416'
  surface-bright: '#37393b'
  surface-container-lowest: '#0c0e10'
  surface-container-low: '#1a1c1e'
  surface-container: '#1e2022'
  surface-container-high: '#282a2c'
  surface-container-highest: '#333537'
  on-surface: '#e2e2e5'
  on-surface-variant: '#d6c2bb'
  inverse-surface: '#e2e2e5'
  inverse-on-surface: '#2f3133'
  outline: '#9e8d86'
  outline-variant: '#51443e'
  surface-tint: '#f7b89d'
  primary: '#ffe4d9'
  on-primary: '#4d2613'
  primary-container: '#ffbfa3'
  on-primary-container: '#7a4b36'
  inverse-primary: '#83533c'
  secondary: '#a4d1b6'
  on-secondary: '#0c3825'
  secondary-container: '#254f3a'
  on-secondary-container: '#93bfa5'
  tertiary: '#deebff'
  on-tertiary: '#0c3254'
  tertiary-container: '#b0d0fb'
  on-tertiary-container: '#39597e'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdbcc'
  primary-fixed-dim: '#f7b89d'
  on-primary-fixed: '#331203'
  on-primary-fixed-variant: '#673c27'
  secondary-fixed: '#bfedd1'
  secondary-fixed-dim: '#a4d1b6'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#254f3a'
  tertiary-fixed: '#d2e4ff'
  tertiary-fixed-dim: '#a9c9f3'
  on-tertiary-fixed: '#001c37'
  on-tertiary-fixed-variant: '#28496c'
  background: '#121416'
  on-background: '#e2e2e5'
  surface-variant: '#333537'
typography:
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1200px
  gutter: 24px
  margin-desktop: 64px
  margin-mobile: 20px
---

## Brand & Style
The design system is a nocturnal evolution of a nurturing environment, shifting from daytime brightness to a restorative, cocoon-like atmosphere. It targets users seeking calm, focus, or wind-down rituals, evoking feelings of safety, quietude, and gentle support. 

The style is **Modern Minimalism** infused with **Glassmorphism**. It prioritizes heavy whitespace (now "darkspace"), soft layering, and a sophisticated use of depth to guide the eye without overstimulation. The interface feels lightweight and breathable despite its dark foundation, utilizing translucent surfaces to maintain a sense of ethereal lightness.

## Colors
The palette is anchored by a deep navy-tinted charcoal that avoids the harshness of pure black. The primary soft peach remains the focal point for action and energy, but its saturation is carefully balanced to prevent "neon" vibrations against the dark base.

- **Background:** A soothing charcoal (#1A1C1E) provides a stable, low-energy foundation.
- **Surface:** Dark greys with subtle warmth (#2D2F31) are used for containers.
- **Accents:** The Sage Green (#A8D5BA) and Soft Blue (#B4D4FF) are shifted toward pastel-neon variants for high legibility while maintaining their calming, organic roots.
- **Text:** High-contrast off-white (#F1F3F4) for primary content and muted lavender-grey (#9AA0A6) for secondary details.

## Typography
The typography uses **Plus Jakarta Sans** for its modern, rounded apertures that feel welcoming and legible in low-light environments. 

Headlines use a tighter letter-spacing and heavier weights to anchor the page, while body text maintains a generous line height (1.5x - 1.6x) to reduce eye strain. On mobile devices, headline sizes scale down to prevent overwhelming the viewport, ensuring the "airy" feel of the design system is preserved across all breakpoints.

## Layout & Spacing
The layout follows a **Fluid Grid** philosophy with a focus on generous negative space. A strict 8px spatial rhythm is applied to all components to ensure mathematical harmony.

- **Desktop:** A 12-column grid with wide 64px margins creates a focused central stage for content.
- **Tablet:** 8-column grid with 32px margins.
- **Mobile:** 4-column grid with 20px margins. Padding within cards and containers should increase as the screen size grows to maintain the "nest" feel—compact and cozy on small screens, expansive and serene on large ones.

## Elevation & Depth
Depth in this design system is created through **Glassmorphism** and **Tonal Layers** rather than heavy shadows. 

1. **Base Layer:** The deepest charcoal background.
2. **Surface Layer:** Translucent panels with a 10% white overlay and 20px backdrop blur. This creates a sense of light passing through glass, maintaining the "nurturing" aesthetic.
3. **Interactive Layer:** Subtle 1px inner borders (top-down) in a low-opacity primary peach highlight the "active" surface.
4. **Shadows:** Only used for floating elements (modals, tooltips). Shadows are extra-diffused, using the deep navy background color rather than black, ensuring they blend naturally into the environment.

## Shapes
The shape language is consistently **Rounded**. There are no sharp corners in the design system, as they conflict with the serene and nurturing brand pillars. 

- **Standard Elements:** Buttons and input fields use 0.5rem (8px).
- **Cards and Containers:** Use 1rem (16px) to create a soft, approachable frame.
- **Large UI Panels:** Use 1.5rem (24px) for major section wrapping. 
- **Icons:** Should always feature rounded terminals and soft junctions to match the typography.

## Components
Consistent component styling reinforces the quiet, high-end nature of the design.

- **Buttons:** Primary buttons use a solid Soft Peach fill with dark text. Secondary buttons use a ghost style with a subtle peach border and 10% peach background fill.
- **Chips:** Highly rounded (pill-shaped) with low-contrast background fills derived from the status colors (Sage, Blue) at 15% opacity.
- **Input Fields:** Backgrounds are slightly darker than the surface layer, using a 1px soft border that glows primary peach when focused.
- **Cards:** Utilize the Glassmorphic treatment—soft blurs and thin, low-opacity strokes—to separate content without creating visual noise.
- **Progress Indicators:** Use the Sage Green for completion and Soft Blue for active states, utilizing "glow" effects (outer blurs) to indicate importance in the dark UI.