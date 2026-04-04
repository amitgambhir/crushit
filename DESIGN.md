# CrushIt Design System

Single source of truth for all visual and interaction decisions. Reference this before building any screen, component, or animation.

---

## Table of Contents

- [Brand Identity](#brand-identity)
- [Color Palette](#color-palette)
- [Typography](#typography)
- [Spacing & Sizing](#spacing--sizing)
- [Component Library](#component-library)
- [Animation & Motion](#animation--motion)
- [Level Progression Visual System](#level-progression-visual-system)
- [Design Patterns](#design-patterns)
- [Asset Pipeline](#asset-pipeline)

---

## Brand Identity

| Attribute | Value |
|---|---|
| Name | CrushIt |
| Emoji mark | 💥 |
| Voice | Energetic, rewarding, never condescending |
| Audience | Kids 6–12 (primary), parents (secondary) |
| UI mode | Dark mode only (`userInterfaceStyle: "dark"`) |
| Orientation | Portrait only |

The app should feel like earning a power-up, not doing homework. Bold shapes, high contrast, visible accumulation.

---

## Color Palette

**Source of truth:** `constants/theme.ts`

### Core Colors

| Token | Hex | Role |
|---|---|---|
| `primary` | `#FF5722` | CTAs, accent rings, "crush energy" |
| `secondary` | `#FFD600` | Crush Points, coins, reward economy |
| `success` | `#00C853` | Task crushed, positive confirmation |
| `warning` | `#FF9800` | Due soon, streak at risk |
| `danger` | `#FF1744` | Overdue, expired, destructive actions |

### Surface Colors

| Token | Hex | Role |
|---|---|---|
| `background` | `#0F0F0F` | App background, splash screen |
| `surface` | `#1C1C1C` | Standard card backgrounds |
| `surface2` | `#2A2A2A` | Elevated cards, modals |
| `text` | `#FFFFFF` | Primary text |
| `textMuted` | `#9E9E9E` | Secondary text, hints, labels |
| `border` | `#333333` | Dividers, input borders |

### Kid Accent Colors

12 selectable accent colors for kid profiles. The accent tints the kid's avatar ring, streak badges, and level bar.

```
#6C63FF  Violet (default)     #FF5722  Orange        #FFD600  Yellow
#00C853  Green                #00BCD4  Cyan          #E91E63  Pink
#9C27B0  Purple               #3F51B5  Indigo        #FF9800  Amber
#F44336  Red                  #4CAF50  Lime Green    #009688  Teal
```

### Color Application Rules

- **Primary (`#FF5722`)** for main CTAs and interactive highlights only — not for large background fills
- **Secondary (`#FFD600`)** reserved for the points economy (PointsBadge, reward costs, balance displays)
- **Status colors** map 1:1 to task states: `success` = approved, `warning` = due soon, `danger` = overdue/expired
- **Surface layering:** `background` → `surface` → `surface2` for depth. Never skip a level.
- **Semi-transparent tints:** Append alpha hex for badge/pill backgrounds (e.g., `#FFD60022` for points pill bg)

---

## Typography

**Source of truth:** `constants/theme.ts` + `tailwind.config.js`

### Font Families

| Font | Role | Tailwind class | Weights available |
|---|---|---|---|
| Nunito | Display, headings, UI labels | `font-nunito`, `font-nunito-bold`, etc. | 400, 600, 700, 800, 900 |
| Inter | Body text, descriptions | `font-inter`, `font-inter-medium`, etc. | 400, 500, 600, 700 |
| JetBrains Mono | Points, numbers, countdowns | `font-mono` | 400 |

### Font Size Scale

| Token | Size | Use |
|---|---|---|
| `xs` | 12px | Small labels, hints, timestamps |
| `sm` | 14px | Secondary text, captions |
| `md` | 16px | Body text (default) |
| `lg` | 18px | Prominent body, card titles |
| `xl` | 22px | Screen titles, section headers |
| `xxl` | 28px | Large section headers |
| `display` | 36px | Dashboard numbers, emphasis |
| `hero` | 48px | Full-screen hero text |

### Typography Rules

- **Headings:** Nunito Bold or Black, `xl`–`hero` sizes
- **Body text:** Inter Regular, `md`–`lg` sizes
- **Secondary/muted:** Inter + `textMuted` color, smaller sizes
- **Points and numbers:** JetBrains Mono — always monospace for numerical values
- **Emphasis within body:** Nunito Bold with accent color, not italic

---

## Spacing & Sizing

**Source of truth:** `constants/theme.ts`

### Spacing Scale (4px baseline)

| Token | Value | Use |
|---|---|---|
| `xs` | 4px | Tight gaps (icon-to-text) |
| `sm` | 8px | Component internal gaps |
| `md` | 16px | Card padding (default), section gaps |
| `lg` | 24px | Between sections |
| `xl` | 32px | Major section breaks |
| `xxl` | 48px | Screen-level padding top/bottom |

### Border Radius

| Token | Value | Use |
|---|---|---|
| `sm` | 8px | Small pills, tags |
| `md` | 12px | Inputs, small cards |
| `lg` | 16px | Standard card radius (default) |
| `xl` | 24px | Large cards, modals |
| `full` | 9999px | Avatars, circular buttons, pill badges |

### Touch Targets

- Minimum touch target: **44px**
- Button heights: `sm` = 40px, `md` = 52px, `lg` = 60px
- Input min height: **52px**

---

## Component Library

All reusable components live in `components/ui/`. Every new screen should compose from these before creating one-off elements.

### Button

**File:** `components/ui/Button.tsx`

| Variant | Use |
|---|---|
| `primary` | Main CTA (orange background) |
| `secondary` | Secondary actions (surface background) |
| `ghost` | Tertiary/inline actions (transparent) |
| `danger` | Destructive actions (red) |

Sizes: `sm` (40h), `md` (52h), `lg` (60h). All buttons fire medium haptic feedback on press.

### Card

**File:** `components/ui/Card.tsx`

Standard wrapper for grouped content. Props: `elevated` (toggles `surface` vs `surface2`), `padding` (`none` | `sm` | `md` | `lg`). Default radius: `lg` (16px).

### Input

**File:** `components/ui/Input.tsx`

Text input with label, error/hint states, optional left/right icons (Ionicons). Secure inputs get a password toggle automatically. Min height 52px.

### KidAvatar

**File:** `components/ui/KidAvatar.tsx`

Avatar circle with accent color ring, emoji or image content, and optional level badge overlay. The ring color comes from the kid's selected `colorTheme`.

### LevelBar

**File:** `components/ui/LevelBar.tsx`

Progress bar showing XP toward next level. Two modes:
- **Full:** Title + level range labels + progress bar
- **Compact:** Level number + progress bar inline

Uses `getLevelInfo()` from `constants/levels.ts`.

### PointsBadge

**File:** `components/ui/PointsBadge.tsx`

Pill displaying a point value with `⚡` icon. Variants: `earn` (green tint), `cost` (yellow tint), `balance` (yellow). Always uses JetBrains Mono for the number.

### TaskCard

**File:** `components/ui/TaskCard.tsx`

Card for a single task with icon, title, due date, recurrence indicator, point value, status pill, and optional assignee avatar. Status pill colors: pending = muted, submitted = warning, approved = success, rejected = danger, expired = danger.

### StreakBadge

**File:** `components/ui/StreakBadge.tsx`

Inline badge showing streak count by type. Icons: `🔥` daily, `📅` weekly, `🌙` monthly, `⭐` yearly. Background tinted with the kid's accent color.

### AchievementBadge

**File:** `components/ui/AchievementBadge.tsx`

Badge icon with earned/locked states. Earned: full color + 2px accent border. Locked: grayscale + 0.5 opacity. Optional progress bar below. Sizes: `sm` (48x48), `md` (64x64).

### ConfettiOverlay

**File:** `components/ui/ConfettiOverlay.tsx`

Full-screen modal overlay triggered on task approval. Semi-transparent backdrop (`#000000BB`), spring-animated content: `🎉` burst, "Task Crushed!" title, points pill, optional badge reveal. Phase 3: replace emoji burst with Lottie confetti.

### PINPad

**File:** `components/ui/PINPad.tsx`

Numeric keypad for kid login and parent PIN lock. 4-digit input with dot indicators.

---

## Animation & Motion

### Libraries

| Library | Version | Purpose |
|---|---|---|
| `react-native-reanimated` | 4.2.1 | Worklet-based layout and gesture animations |
| `lottie-react-native` | ~7.3.6 | Pre-recorded celebration sequences (Phase 3) |
| `expo-haptics` | ~55.0.9 | Tactile feedback on interactions |

### Current Animation Patterns

**ConfettiOverlay sequence:**
1. **Pop-in:** Parallel spring scale (0.4 → 1, friction 5) + timing opacity fade-in
2. **Hold:** 2200ms at full visibility
3. **Fade-out:** 400ms opacity to 0

**Haptic feedback:** Medium impact on all primary button presses.

### Animation Guidelines

- Keep animations under 300ms for interactions (button presses, toggles)
- Celebration animations can run longer (2–3s) since they're non-blocking moments of reward
- Use spring physics for scale animations (feels alive), timing for opacity/fades (feels clean)
- Never animate layout shifts that block user input
- All animations must be skippable via tap for accessibility

---

## Level Progression Visual System

**Source of truth:** `constants/levels.ts`

### Fixed Tiers (Levels 1–10)

| Level | Title | Points Required |
|---|---|---|
| 1 | Rookie Crusher 🥊 | 0 |
| 2 | Task Tackler 💪 | 50 |
| 3 | Go-Getter ⚡ | 125 |
| 4 | Power Player 🔥 | 250 |
| 5 | Crush Machine 🤖 | 450 |
| 6 | Boss Mode 😎 | 700 |
| 7 | Unstoppable 🚀 | 1000 |
| 8 | Elite Crusher 🏅 | 1400 |
| 9 | Legend in Training 🌟 | 1900 |
| 10 | Full Legend 🏆 | 2500 |

### Scaling Tiers (Levels 11+)

| Range | Step | Title |
|---|---|---|
| 11–15 | +700 pts each | Champion Crusher 🥇 |
| 16–20 | +1000 pts each | Mega Champion 💥 |
| 21+ | +1500 pts each | Ultimate Crusher 👑 |

### Level UI Rules

- Level badge always visible on kid avatar and dashboard
- Progress bar fills left-to-right using kid's accent color
- "X pts to next" shown below bar; at max level show "Max level!"
- Level-up triggers a celebration (notification + animation)

---

## Design Patterns

### Surface Layering

```
Background (#0F0F0F)
  └── Card / Surface (#1C1C1C)
        └── Elevated Card / Surface2 (#2A2A2A)
              └── Modal overlay (#000000BB)
```

Never place `surface` on `surface` — always step up to `surface2` for nested cards.

### Status Color Mapping

| State | Color | Icon hint |
|---|---|---|
| Pending | `textMuted` | Clock |
| Submitted | `warning` | Hourglass |
| Approved | `success` | Checkmark |
| Rejected | `danger` | X mark |
| Expired | `danger` | Calendar-X |
| Overdue | `danger` border | Existing icon + red border |

### Icon System

Using `@expo/vector-icons` (Ionicons set). Prefer filled variants for active states, outline for inactive.

### Interaction States

| State | Treatment |
|---|---|
| Default | Full opacity, standard colors |
| Pressed | 0.75 opacity (TouchableOpacity default) |
| Disabled | 0.5 opacity, no haptic |
| Loading | ActivityIndicator replaces label, input blocked |
| Error | `danger` color border + error message below |

### Empty States

Every list screen should handle the empty case with:
- A relevant emoji (centered, large)
- One line of text explaining what will appear here
- A CTA button if the user can take action to populate the list

---

## Asset Pipeline

### Current Assets (`/assets/`)

| File | Purpose | Spec |
|---|---|---|
| `icon.png` | App icon (iOS + fallback) | 1024x1024, no transparency |
| `adaptive-icon.png` | Android adaptive icon foreground | 1024x1024, transparent bg, content in safe zone |
| `splash.png` | Splash screen image | Centered on `#0F0F0F`, `resizeMode: contain` |

### App Store Requirements

- **iOS icon:** 1024x1024 PNG, no alpha, no rounded corners (iOS applies the mask)
- **Android adaptive icon:** Foreground layer with content inside the 66% safe zone; background color `#0F0F0F`
- **Splash:** Must match `backgroundColor: "#0F0F0F"` in `app.json` for seamless transition into the app

### Icon Design Constraints

- Must read clearly from 1024px down to 40px — bold shapes, no fine detail
- Should work on both dark and light OS home screen backgrounds
- Visual motifs that fit the brand: fist bump, lightning bolt, explosion/burst (💥)
- Style: premium and energetic, not cartoonish — should appeal to a 10-year-old as much as a 6-year-old
- Display font reference for any text in the icon: Nunito Bold

---

## NativeWind / Tailwind Reference

**Config:** `tailwind.config.js`

All theme tokens from `constants/theme.ts` are mapped into the Tailwind config so they can be used as utility classes. Font family classes:

```
font-nunito              Nunito_400Regular
font-nunito-semibold     Nunito_600SemiBold
font-nunito-bold         Nunito_700Bold
font-nunito-extrabold    Nunito_800ExtraBold
font-nunito-black        Nunito_900Black
font-inter               Inter_400Regular
font-inter-medium        Inter_500Medium
font-inter-semibold      Inter_600SemiBold
font-inter-bold          Inter_700Bold
font-mono                JetBrainsMono_400Regular
```

When adding new design tokens, update both `constants/theme.ts` and `tailwind.config.js` to keep them in sync.
