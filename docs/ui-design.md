# DeepRead UI Design Guidelines

Use this document as the visual source of truth for frontend work.

DeepRead should feel like a calm academic reading desk: modern, focused, trustworthy, and beginner-friendly. It must not look like a flashy AI startup or an ecommerce catalog.

---

## 1. Core Principles

- Prioritize readability over decoration.
- Use clear hierarchy and generous whitespace.
- Keep interactions calm and predictable.
- Use academic blue as the primary brand color.
- Use muted amber only as a subtle accent.
- Support both light and dark themes.
- Prefer shared components over page-specific styling.
- Keep animation subtle and functional.
- Avoid visual clutter, oversized cards, and unnecessary gradients.

---

## 2. Brand Assets

Store brand assets in:

```text
apps/web/public/brand/
```

Files:

```text
deepread-mark.svg
deepread-wordmark.svg
```

Usage:

- `deepread-mark.svg` — navbar, mobile layout, loading, and logout state.
- `deepread-wordmark.svg` — login, register, landing page, and wider brand presentation.

Rules:

- Prefer SVG with transparent background.
- Preserve aspect ratio.
- Avoid excessive whitespace inside the asset.
- Use Next.js `Image` when appropriate.
- Do not recreate the logo using text or inline SVG in multiple components.

---

## 3. Color System

### Light Theme

| Token          | Value     |
| -------------- | --------- |
| Background     | `#F8F6F0` |
| Surface        | `#FFFFFF` |
| Surface Muted  | `#F2F0EA` |
| Text Primary   | `#1F2933` |
| Text Secondary | `#667085` |
| Border         | `#E5E1D8` |
| Primary        | `#2F5D8C` |
| Primary Hover  | `#244B72` |
| Accent         | `#C9973F` |
| Destructive    | `#B42318` |

### Dark Theme

Use the existing theme tokens when available.

Recommended direction:

| Token          | Direction                        |
| -------------- | -------------------------------- |
| Background     | Deep blue-gray                   |
| Surface        | Slightly lighter than background |
| Text Primary   | Warm off-white                   |
| Text Secondary | Muted cool gray                  |
| Border         | Low-contrast blue-gray           |
| Primary        | Soft academic blue               |
| Accent         | Muted amber                      |

Do not use pure black backgrounds or high-saturation neon colors.

---

## 4. Difficulty Colors

| Difficulty        | Background | Text      |
| ----------------- | ---------- | --------- |
| Beginner Friendly | `#DDEFE6`  | `#2F6F5E` |
| Moderate          | `#E8F0FA`  | `#2F5D8C` |
| Difficult         | `#FFF1D6`  | `#9A5B13` |
| Expert            | `#F8DDDD`  | `#9B2C2C` |

Difficulty must not be communicated through color alone. Always include text labels.

---

## 5. Typography

- Use Inter for UI text, labels, buttons, forms, and navigation.
- Use Source Serif 4 for major headings or paper titles only when already configured.
- Avoid introducing new fonts for individual pages.
- Keep body text readable with comfortable line height.
- Limit reading content width to approximately `65–75ch`.
- Avoid excessive bold text.
- Use sentence case for headings and buttons.

Recommended hierarchy:

- Page title: strong but not oversized.
- Section title: clearly separated from body content.
- Body: normal weight.
- Metadata and helper text: smaller and muted.
- Paper titles: serif when available.

---

## 6. Spacing and Layout

- Use consistent spacing increments.
- Prefer `max-width` containers over full-width content.
- Keep main content centered on large screens.
- Use generous page padding.
- Avoid placing important content directly against viewport edges.
- Use a single-column layout on mobile.
- Prevent horizontal overflow at 320px width.

Recommended content widths:

| Page Type       | Width  |
| --------------- | ------ |
| Reading page    | Narrow |
| Login/Register  | Medium |
| Paper library   | Wide   |
| Admin dashboard | Wide   |
| Modal/Form      | Medium |

---

## 7. Cards and Surfaces

Cards should use:

- theme-appropriate surface;
- soft border;
- consistent radius;
- subtle shadow only when needed;
- clear internal hierarchy.

Avoid:

- heavy shadows;
- nested cards;
- glowing borders;
- excessive glassmorphism;
- large decorative backgrounds;
- ecommerce-style card grids for paper lists.

Paper results should generally use readable list-based cards.

---

## 8. Buttons and Actions

- Use one clear primary action per section.
- Use secondary or outline buttons for supporting actions.
- Use destructive styling only for destructive operations.
- Disable actions while pending.
- Show visible hover, focus, disabled, and loading states.
- Do not rely only on icons for important actions.
- Keep button labels specific and concise.

Examples:

```text
Start Reading
Save Progress
Add Bookmark
Run Classification
Publish Paper
```

---

## 9. Forms

Forms must include:

- visible labels;
- clear focus states;
- helpful validation messages;
- consistent input height;
- disabled and submitting states;
- server error feedback near the form.

Do not use placeholder text as the only label.

Error messages should explain what happened without exposing raw server errors.

---

## 10. Authentication Pages

Login and registration should share a reusable responsive layout.

Desktop:

- two-column or balanced asymmetric layout;
- brand context on one side;
- form card on the other;
- restrained visual decoration;
- use `deepread-wordmark.svg`.

Mobile:

- single-column layout;
- wordmark above the form;
- comfortable horizontal padding;
- no overflow;
- full-width primary button.

Do not add unavailable features such as:

- OAuth;
- forgot password;
- email verification;
- interest selection.

Preserve all existing authentication logic, validation, redirects, and `next` query behavior.

---

## 11. Logout State

When logout begins:

- disable repeated logout clicks;
- show `Signing out...`;
- show a subtle spinner or transition;
- use `deepread-mark.svg`;
- keep the state visible only while the request is pending;
- restore the UI when logout fails;
- preserve the existing successful redirect.

The pending visual must not be treated as proof that the server session has ended.

---

## 12. Paper Library

Paper list items should clearly show:

- title;
- authors;
- publication year;
- category;
- difficulty;
- beginner score;
- estimated reading time;
- bookmark or reading status when relevant.

Prioritize title and difficulty information.

Avoid large thumbnail-driven layouts because papers may not have meaningful cover images.

---

## 13. Paper Detail and Reading Mode

Paper detail should prioritize:

1. title;
2. authors and publication metadata;
3. difficulty classification;
4. abstract;
5. classification reason;
6. reading warning;
7. source or legal PDF action.

Reading mode should use:

- limited content width;
- comfortable line height;
- minimal navigation distraction;
- clear progress controls;
- accessible notes interaction.

Do not imitate a PDF viewer when only metadata and abstract are available.

---

## 14. Profile, Notes, and Statistics

These pages should feel useful without becoming dashboard-heavy.

- Keep summaries compact.
- Use charts only when they improve comprehension.
- Prefer labeled values and simple distributions.
- Avoid gamification.
- Use empty states that explain the next action.

---

## 15. Admin Interface

Admin pages may be denser than public pages but must retain the same design system.

Prioritize:

- clear status labels;
- readable tables and filters;
- safe destructive actions;
- visible pending states;
- useful empty and error states;
- request IDs for troubleshooting when available.

Do not expose raw provider metadata or technical stack traces.

---

## 16. Loading, Empty, Error, and Success States

Every data-driven page should account for:

- loading;
- empty;
- error;
- retry;
- success;
- pending mutation.

Guidelines:

- Use skeletons for structured content.
- Use spinners for small actions.
- Empty states should explain what the user can do next.
- Error states should provide retry when appropriate.
- Do not redirect users to login while session status is still pending or failed.
- Do not use `notFound()` for valid empty datasets.

---

## 17. Responsive Behavior

Verify frontend visual changes at minimum on:

```text
320px
768px
1024px
1440px
```

Requirements:

- no horizontal overflow;
- navigation remains usable;
- forms remain readable;
- buttons remain tappable;
- tables may scroll only when necessary;
- content hierarchy remains consistent.

---

## 18. Accessibility

- Use semantic HTML.
- Preserve visible keyboard focus.
- Ensure sufficient contrast.
- Associate labels with form controls.
- Provide alt text for meaningful images.
- Use `aria-live` for important async feedback when appropriate.
- Do not communicate status using color alone.
- Avoid unnecessary motion.
- Respect reduced-motion preferences when adding animation.

---

## 19. Avoid

Do not use:

- neon colors;
- heavy gradients;
- excessive animation;
- oversized hero sections;
- glassmorphism across all cards;
- decorative elements without function;
- inaccessible icon-only actions;
- duplicated brand components;
- hard-coded production URLs in UI components;
- visual redesigns that alter application behavior.

---

## 20. Visual Review Checklist

Before completing a UI task, verify:

- light theme;
- dark theme;
- desktop;
- mobile;
- loading state;
- empty state;
- error state;
- pending mutation;
- keyboard focus;
- text contrast;
- no overflow;
- no broken logo background;
- unchanged application behavior.
