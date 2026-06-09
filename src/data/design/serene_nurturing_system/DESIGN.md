---
name: Serene Nurturing System
colors:
  surface: '#fbf9f4'
  surface-dim: '#dbdad5'
  surface-bright: '#fbf9f4'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3ee'
  surface-container: '#efeee9'
  surface-container-high: '#eae8e3'
  surface-container-highest: '#e4e2de'
  on-surface: '#1b1c19'
  on-surface-variant: '#51443e'
  inverse-surface: '#30312e'
  inverse-on-surface: '#f2f1ec'
  outline: '#84746d'
  outline-variant: '#d6c2bb'
  surface-tint: '#83533c'
  primary: '#83533c'
  on-primary: '#ffffff'
  primary-container: '#ffbfa3'
  on-primary-container: '#7a4b36'
  inverse-primary: '#f7b89d'
  secondary: '#625e56'
  on-secondary: '#ffffff'
  secondary-container: '#e6dfd5'
  on-secondary-container: '#67625a'
  tertiary: '#486646'
  on-tertiary: '#ffffff'
  tertiary-container: '#b5d6af'
  on-tertiary-container: '#415e3f'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbcc'
  primary-fixed-dim: '#f7b89d'
  on-primary-fixed: '#331203'
  on-primary-fixed-variant: '#673c27'
  secondary-fixed: '#e9e1d8'
  secondary-fixed-dim: '#ccc5bc'
  on-secondary-fixed: '#1e1b15'
  on-secondary-fixed-variant: '#4a463f'
  tertiary-fixed: '#caecc4'
  tertiary-fixed-dim: '#aecfa9'
  on-tertiary-fixed: '#052108'
  on-tertiary-fixed-variant: '#314d30'
  background: '#fbf9f4'
  on-background: '#1b1c19'
  surface-variant: '#e4e2de'
typography:
  display-lg:
    fontFamily: Nunito Sans
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Nunito Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-lg-mobile:
    fontFamily: Nunito Sans
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
  headline-md:
    fontFamily: Nunito Sans
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
  body-lg:
    fontFamily: Nunito Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Nunito Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Nunito Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Nunito Sans
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 32px
  xl: 48px
  container-padding: 20px
  gutter: 16px
---

## Brand & Style

The design system is centered on the concept of a "digital sanctuary" for parents. The brand personality is calm, empathetic, and deeply trustworthy, acknowledging the cognitive load of early parenthood. The aesthetic avoids the sterile coldness of medical apps and the chaotic energy of typical "baby" brands.

The chosen style is a fusion of **Modern Minimalism** and **Tactile Softness**. It utilizes generous whitespace, organic shapes, and a soft-focus depth to create an environment that feels light and breathable. The goal is to evoke an emotional response of security and warmth, ensuring that even at 3 AM, the interface feels like a gentle assistant rather than a bright, demanding screen.

## Colors

The color palette is rooted in a **Warm Cream (#FFFDF8)** base to reduce eye strain and provide a premium, paper-like quality. The **Soft Peach (#FFBFA3)** serves as the primary brand touchpoint, used for key actions and brand moments. 

Secondary accents like **Sage Green**, **Soft Blue**, and **Lavender** are used functionally to categorize different tracking types (e.g., feeding, sleep, health) without creating visual noise. These pastels are carefully calibrated to maintain high legibility against the cream background. Text is kept to a **Dark Charcoal (#2F2F2F)** rather than pure black to maintain the soft visual threshold.

## Typography

This design system utilizes **Nunito Sans** for its friendly, rounded terminals that mirror the soft geometry of the UI. The typographic hierarchy is intentionally spacious.

- **Headlines:** Use Bold or ExtraBold weights to provide clear structure and a sense of confidence.
- **Body Text:** Primarily uses the Regular weight for maximum legibility. The slightly larger base size (16px) caters to tired eyes and mobile-first interactions.
- **Labels:** Use SemiBold to provide contrast against body text without needing to increase size, maintaining a compact information density in tracking logs.

## Layout & Spacing

The layout follows a **fluid grid** model optimized for one-handed mobile use. The 8px base unit ensures a consistent rhythm across all components.

- **Safe Margins:** Use a minimum of 20px (container-padding) on the horizontal axis to prevent content from feeling cramped against the screen edges.
- **Vertical Spacing:** Elements are grouped using 12px or 24px gaps, with larger 48px breaks used to distinguish major sections (e.g., moving from the "Daily Summary" to "Milestones").
- **Touch Targets:** All interactive elements must maintain a minimum hit area of 44x44px, with primary action buttons ideally reaching 56px in height for "thumb-friendly" accessibility.

## Elevation & Depth

Visual hierarchy is achieved through **Tonal Layering** and **Ambient Shadows**. 

1.  **Base Layer:** The Warm Cream (#FFFDF8) background.
2.  **Card Layer:** Secondary Cream (#FFF7ED) or White surfaces used for content containers.
3.  **Shadows:** Shadows are extremely soft and diffused, using a hint of the Primary Peach or Sage Green in the shadow color (e.g., `rgba(255, 191, 163, 0.15)`) instead of grey. This creates a "floating" effect that feels light and airy.
4.  **Interactive Depth:** On press, buttons and cards should subtly "sink" (reduce shadow blur and Y-offset) to provide tactile feedback without looking mechanical.

## Shapes

The shape language is defined by high-radius curves to eliminate any "sharp" or "dangerous" edges, echoing the safety and softness of a nursery.

- **Large Containers/Cards:** Use a fixed **24px radius**. This "super-ellipse" feel creates the signature scrapbook look.
- **Buttons & Chips:** Use a **fully rounded (pill-shaped)** approach to distinguish interactive elements from static content cards.
- **Small Elements (Inputs/Checkboxes):** Use an 8px (Soft) radius to maintain internal consistency while allowing for better text alignment.

## Components

### Buttons
Primary buttons are pill-shaped, using the Soft Peach background with Dark Charcoal text. They use a subtle inner-glow to appear slightly 3D. Secondary buttons use a Sage Green outline or a tonal tint.

### Scrapbook Milestone Cards
These are the hero components. They feature 24px rounded corners, a soft ambient shadow, and a large image area. The "date" label should be styled like a small physical tag or sticker in the corner using the Soft Yellow or Lavender accents.

### Timeline Views
A vertical dotted line in Muted Text connects activity icons. Activity icons are housed in soft-colored circles (32px) matching their category (e.g., Blue for sleep, Peach for feeding).

### Segmented Controls
Used for toggling between "Today", "Week", and "Month". These should look like a single pill-shaped container where the active state is a white "floating" pill that slides behind the text.

### Input Fields
Inputs are borderless with a Secondary Cream (#FFF7ED) background. They use a 12px padding and 16px corner radius. The focus state is indicated by a soft 2px Peach glow rather than a harsh border change.

### Progress Bars
Used for growth charts or sleep goals. These are thick (12px), fully rounded tracks with a high-contrast Sage Green or Peach fill, avoiding thin, needle-like lines.