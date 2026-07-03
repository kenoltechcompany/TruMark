---
theme:
  colors:
    background: "#F6F8FA"
    surface: "#FFFFFF"
    border: "#D0D7DE"
    text-primary: "#1F2328"
    text-secondary: "#656D76"
    primary: "#0969DA"
    success: "#1F883D"
  typography:
    font-family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif"
    base-size: "14px"
---

# Shinaa Design System (GitHub Primer Inspired)

## Core Philosophy
The UI must prioritize utility, scannability, and data density. Avoid decorative elements. Rely on spacing, clear typography, and subtle borders to separate information.

## Styling Rules (Tailwind CSS)

### 1. Layout & Surfaces
* **Backgrounds:** Use `bg-[#F6F8FA]` for the main app background and `bg-white` for content panels, cards, or modals.
* **Borders:** Use `border border-[#D0D7DE] rounded-md` for structural elements like layout cards, tables, and inputs.
* **Shadows:** Use very subtle shadows, primarily `shadow-sm`, only on interactive dropdowns or floating modals.

### 2. Typography
* **Text Colors:** Use `text-[#1F2328]` for primary headings and body copy. Use `text-[#656D76]` for helper text, table headers, and secondary information.
* **Font Sizing:** Keep text relatively compact. Use `text-sm` for standard table data and inputs. Use `text-base` or `text-lg` with `font-semibold` for panel headers.

### 3. Components
* **Primary Buttons (Actions like Save/Submit):** `bg-[#0969DA] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#0353A4] transition-colors`.
* **Success Buttons (Actions like "Mark Taken" / "Mark Done"):** `bg-[#1F883D] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#1A7F37] transition-colors`.
* **Secondary/Default Buttons:** `bg-[#F6F8FA] border border-[#D0D7DE] text-[#24292F] px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#F3F4F6] transition-colors`.
* **Inputs:** `border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] focus:border-transparent shadow-sm`.
* **Tables:** Must have a clear header `bg-[#F6F8FA] border-b border-[#D0D7DE]`. Cells should have generous horizontal padding `px-4` but compact vertical padding `py-2`.

### 4. Spacing
* Use a dense grid. Standard padding inside components is `p-4` or `p-6`. Gap between form elements is `gap-3` or `gap-4`.