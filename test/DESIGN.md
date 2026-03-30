# Design System: The Collaborative Canvas



## 1. Overview & Creative North Star

**Creative North Star: The Collaborative Canvas**

This design system is envisioned as an infinite, technical workspace where precision meets depth. It moves away from the flat, utilitarian nature of standard SaaS platforms toward a high-end, editorial experience. By blending the structured functionality of a node-based interface with the atmospheric depth of dark-mode aesthetics, we create a environment that feels like a digital laboratory.



To break the "template" look, this system utilizes **Tonal Layering** and **Intentional Asymmetry**. We prioritize white space (negative space) over structural lines, allowing the eye to navigate through color shifts and typographic hierarchy rather than rigid boxes. Elements are allowed to overlap slightly, and glassmorphic properties ensure that the UI feels integrated into the canvas, not merely pasted on top of it.



---



## 2. Colors

Our palette is rooted in deep, obsidian foundations, punctuated by vibrant, low-frequency glows.



### Surface Hierarchy & Nesting

We reject the use of 1px solid borders for sectioning. This is the **"No-Line Rule."** Instead, hierarchy is defined by shifts in background tokens:

* **Canvas Base:** `surface` (#131313) – The infinite foundation.

* **Primary Work Area:** `surface_container_low` (#1C1B1B) – Subtle lift from the canvas.

* **Functional Cards:** `surface_container` (#201F1F) – Floating interactive elements.

* **Active Overlays:** `surface_container_highest` (#353534) – High-priority modals or tooltips.



### The Glass & Gradient Rule

Main CTAs and critical nodes must utilize subtle gradients transitioning from `primary` (#D0BCFF) to `primary_container` (#A078FF). Floating panels should employ **Glassmorphism**: a semi-transparent `surface_variant` with a 20px backdrop blur, allowing the "nodes" beneath to softly bleed through.



### Accent Roles

* **Primary (Vibrant Purple):** Focus, primary actions, and primary node connectors.

* **Secondary (Teal):** Success states, alternate data paths.

* **Tertiary (Gold):** Warnings, highlighted insights, or "Note" headers.

* **Error (Burgundy):** Critical failures, destructive actions.



---



## 3. Typography

Typography is treated as an editorial element. We use a dual-font strategy to balance technical precision with high-end readability.



* **Display & Headlines (Inter):** High-contrast scaling. Large `display-lg` headings should use tight tracking (-0.02em) to feel authoritative and monolithic against the dark background.

* **Labels & Monospace (Space Grotesk):** For technical data, node IDs, and metadata. This introduces a "scientific" feel to the creative canvas.



The hierarchy communicates brand identity by using extreme scale: a very large `headline-lg` paired with a very small, uppercase `label-md` creates a sophisticated, asymmetrical tension that feels modern and custom.



---



## 4. Elevation & Depth

Depth is a physical property in this system, conveyed through light and stacking rather than traditional dropshadows.



* **The Layering Principle:** Place a `surface_container_lowest` (#0E0E0E) element inside a `surface_container` (#201F1F) to create an "inset" effect. Use "stacking" of containers to indicate parent-child relationships in the node graph.

* **Ambient Shadows:** For floating elements, use a 40px blur at 6% opacity. The shadow color should be tinted with `primary` (#D0BCFF) to simulate the glow of a light-emitting screen.

* **The Ghost Border:** If separation is required for accessibility, use `outline_variant` at 15% opacity. High-contrast, 100% opaque borders are strictly prohibited.

* **Node Connectors:** Connectors are not lines; they are "light paths." Use the `primary` or `secondary` token with a subtle outer glow (neon effect) to signify active data flow.



---



## 5. Components



### Nodes & Cards

* **Styling:** No solid borders. Use `surface_container` with an 8px - 12px radius (`md` scale).

* **Nesting:** Inner content should be padded by `spacing-4` (1rem).

* **Interaction:** On hover, the background shifts from `surface_container` to `surface_bright` with a 200ms ease-in-out transition.



### Buttons

* **Primary:** Gradient fill (`primary` to `primary_container`) with white `on_primary` text. No border.

* **Secondary:** Ghost style. Transparent background with a `Ghost Border` and `primary` text.

* **Tertiary:** Text-only with an underline appearing only on hover.



### Inputs & Fields

* **Base:** `surface_container_lowest` background.

* **State:** When focused, the Ghost Border opacity increases to 40% and a subtle `primary` glow emanates from the bottom edge.



### Chips & Nodes

* **Data Chips:** Small (`sm` spacing), high-contrast background using `tertiary_container` for visibility.

* **Connectors:** 2px stroke width, using the `primary_fixed_dim` token.



---



## 6. Do's and Dont's



### Do:

* **Do** use `surface_container` tiers to create hierarchy.

* **Do** embrace negative space. If a layout feels crowded, increase spacing using the `spacing-16` or `spacing-20` tokens.

* **Do** use gradients on node connectors to show directionality (e.g., `primary` to `secondary`).

* **Do** ensure all "Glass" elements have a `backdrop-filter: blur(12px)`.



### Don't:

* **Don't** use 1px solid #000000 or high-contrast borders to separate sections.

* **Don't** use standard "drop shadows" (black, high-opacity).

* **Don't** use flat white (#FFFFFF) for body text; use `on_surface_variant` (#CBC3D7) to reduce eye strain and maintain the atmospheric mood.

* **Don't** mix more than two accent colors in a single component.