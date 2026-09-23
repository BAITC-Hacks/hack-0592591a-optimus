# OrgScope Design System

Visual language for the OrgScope frontend: the AI agent that compares "before" and "after" organisational documents for АО «Казахтелеком» (Task 1: organisational structure and function analysis).

The system borrows the look of the public Kazakhtelecom dealer site: saturated corporate blue, an orange call-to-action, white rounded cards on a pale blue background, and the Kazakh ornament band. It then adapts that look for an analytical tool. OrgScope is a work tool, not a marketing site, so the blue gradient is used sparingly and most screens are calm white cards with dense, readable data.

- Tokens (CSS custom properties): [`src/styles/tokens.css`](src/styles/tokens.css)
- Components: [`src/styles/components.css`](src/styles/components.css)
- Icons: [`src/Icon.vue`](src/Icon.vue) (`<Icon name="upload" />`)
- Logo: [`src/BrandMark.vue`](src/BrandMark.vue) (a placeholder mark, not the Kazakhtelecom logo)
- Both CSS files and the fonts are imported once in [`src/main.js`](src/main.js). Screen-specific layout stays in each component's `<style scoped>`.

---

## 1. Design principles

1. **Traceability is visible.** Every finding carries its source (document, clause, quote) directly on screen, never hidden behind more than one click. The source chip is a first-class component (§6.9).
2. **Advisory, not authoritative.** Every results screen shows the advisory banner (§6.8). The UI never says "violation"; it says "possible loss", "possible duplication" or "potential conflict of interest".
3. **One primary action per screen.** The orange gradient button is reserved for the single most important action (for example "Запустить анализ" or "Скачать заключение"). Everything else is blue or neutral.
4. **Semantic colour is data, brand colour is chrome.** Brand blue and orange belong to navigation and actions. Status colours (§2.3) only describe the analysis results, and they always come with an icon and a text label, never colour alone.
5. **Calm density.** Analysts compare long lists. Use white cards, generous row height (44 to 52 px) and restrained shadows. Reserve decoration (gradients, ornament, watermark numbers) for page headers and empty or onboarding states.

---

## 2. Colour

### 2.1 Brand

| Token | Hex | Use |
|---|---|---|
| `--kt-blue-900` | `#062E6F` | Deep text on blue surfaces, footer bottom |
| `--kt-blue-800` | `#0842A0` | Hero gradient start |
| `--kt-blue-700` | `#0052CC` | Pressed state of primary blue |
| `--kt-blue-600` | `#0A6FE0` | **Primary brand blue**: links, active chips, icons, secondary buttons |
| `--kt-blue-500` | `#1E88FF` | Hero gradient end, focus ring base |
| `--kt-blue-100` | `#E3EEFD` | Selected rows, hover of ghost buttons |
| `--kt-blue-50` | `#F2F7FE` | Page background |
| `--kt-orange-600` | `#F07800` | CTA gradient end, CTA pressed |
| `--kt-orange-500` | `#FF8A00` | **CTA orange** |
| `--kt-orange-400` | `#FFA126` | CTA gradient start |

**Gradients**

- `--grad-hero: linear-gradient(135deg, #0842A0 0%, #0A6FE0 55%, #1E88FF 100%)`: page headers, the upload hero, the footer.
- `--grad-cta: linear-gradient(180deg, #FFA126 0%, #FF8A00 100%)`: the primary CTA only.
- `--grad-tile: linear-gradient(145deg, #1E88FF 0%, #0A6FE0 100%)`: icon tiles.
- `--grad-band`: the blue band with the Kazakh ornament, used for card headers (see §5.3).

### 2.2 Neutrals

| Token | Hex | Use |
|---|---|---|
| `--ink-900` | `#101A2E` | Headings |
| `--ink-800` | `#1D2940` | Body text |
| `--ink-600` | `#4A5872` | Secondary text |
| `--ink-500` | `#6B7A93` | Captions, placeholders, table headers |
| `--ink-300` | `#B6C1D3` | Disabled text, dividers on blue |
| `--line` | `#E3EAF4` | Card borders, table rules |
| `--line-strong` | `#CBD6E6` | Input borders |
| `--surface` | `#FFFFFF` | Cards |
| `--surface-muted` | `#F7F9FC` | Table header, nested panels |
| `--bg` | `#F2F7FE` | App background |

### 2.3 Semantic (domain) colours

These are specific to the analysis results. Every status has a solid colour (icon, text, left border), a soft tint (badge background) and a fixed icon.

**Unit status** (Must-have M1):

| Status | RU label | Token | Solid | Tint | Icon |
|---|---|---|---|---|---|
| Created | Создано | `--st-created` | `#0E9F6E` | `#E4F7EF` | `plus-circle` |
| Kept | Сохранено | `--st-kept` | `#4A5872` | `#EEF2F7` | `check-circle` |
| Reorganized | Реорганизовано | `--st-reorg` | `#0891B2` | `#E0F4F9` | `shuffle` |
| Abolished | Упразднено | `--st-abolished` | `#8A94A6` | `#F1F3F6` | `minus-circle` (label struck through) |

**Finding type** (Must-have M2 and M3):

| Finding | RU label | Token | Solid | Tint | Icon |
|---|---|---|---|---|---|
| Lost function | Потеря функции | `--fx-loss` | `#D92D20` | `#FDECEA` | `alert-octagon` |
| Duplication | Дублирование | `--fx-dup` | `#C27400` | `#FFF4E0` | `copy` |
| Conflict of interest | Конфликт интересов | `--fx-conflict` | `#7A3EE0` | `#F1EAFD` | `scale` |
| Match / no issue | Совпадение | `--fx-ok` | `#0E9F6E` | `#E4F7EF` | `check` |

**Confidence** (how strongly the agent's claim is supported by the sources): High `#0E9F6E`, Medium `#C27400`, Low `#8A94A6`. Show it as a 3-segment meter plus a label, never as a bare percentage.

**System feedback**: success `#0E9F6E`, info `--kt-blue-600`, warning `#C27400`, error `#D92D20`.

> Why the duplication amber is darker than the brand orange: brand orange (`#FF8A00`) means "click me". Duplication amber (`#C27400`) means "look at this". The darker, browner tone keeps them apart, and duplication always appears as a tinted badge with an icon, never as a filled button.

### 2.4 Contrast rules

- Body text on white: `--ink-800` (contrast 14:1). Captions: `--ink-500` or darker (4.6:1).
- White text is allowed on `--kt-blue-600` and darker, on the hero gradient, and on `--grad-cta` only at 14 px bold or larger.
- Semantic solids pass 4.5:1 on their own tint and on white. Do not put semantic text on the blue gradient.

---

## 3. Typography

- **Family:** `"Nunito Sans"` (headings and UI), fallback `"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`. The rounded geometric sans matches the Kazakhtelecom site and has full Cyrillic support, including Kazakh letters (Ә Ғ Қ Ң Ө Ұ Ү Һ І).
- **Numbers:** use `font-variant-numeric: tabular-nums` in tables, KPIs and clause numbers.
- **Quotes from documents:** `"PT Serif", Georgia, serif`, italic off, 15 px. A serif marks the text as verbatim from the source, not generated by the agent.
- Fonts are self-hosted through `@fontsource/nunito-sans` and `@fontsource/pt-serif`, bundled by Vite at build time, so the app works offline. Never link Google Fonts.

| Token | Size / line height | Weight | Use |
|---|---|---|---|
| `--fs-display` | 40 / 48 | 800, UPPERCASE optional | Hero title ("КАК ПРОИСХОДИТ…" style) |
| `--fs-h1` | 30 / 38 | 800 | Page title |
| `--fs-h2` | 22 / 30 | 800 | Section title |
| `--fs-h3` | 18 / 26 | 700 | Card title |
| `--fs-body` | 15 / 24 | 400 | Body |
| `--fs-sm` | 13 / 20 | 400–600 | Table cells, secondary text |
| `--fs-xs` | 12 / 16 | 700, UPPERCASE, `letter-spacing: .12em` | Eyebrow ("ПРОСТО И БЫСТРО"), table headers |
| `--fs-kpi` | 36 / 40 | 800 | KPI numbers |

**Heading pattern from the reference site:** an eyebrow (blue, uppercase, spaced), then the title where **one key word is blue** (`<span class="accent">`), then the ornament divider (`.divider-ornament`). Use it once per page, in the page header only.

---

## 4. Layout, spacing, shape

- **Grid:** 12 columns, max content width `1200px`, gutter 24 px, page padding 24 px (16 px under 768 px).
- **Spacing scale (4 px base):** `--sp-1` 4 · `--sp-2` 8 · `--sp-3` 12 · `--sp-4` 16 · `--sp-5` 20 · `--sp-6` 24 · `--sp-8` 32 · `--sp-10` 40 · `--sp-12` 48 · `--sp-16` 64.
- **Radii:** `--r-sm` 8 px (buttons, inputs, chips) · `--r-md` 12 px (small cards, table container) · `--r-lg` 16 px (main cards) · `--r-xl` 20 px (hero panels) · `--r-pill` 999 px (letter chips, avatars, the scroll-to-top button).
- **Shadows** (blue tinted, never grey):
  - `--sh-1: 0 1px 2px rgba(10,50,120,.06), 0 1px 1px rgba(10,50,120,.04)`: tables, inputs
  - `--sh-2: 0 6px 20px rgba(10,60,140,.08)`: cards
  - `--sh-3: 0 16px 40px rgba(10,60,140,.14)`: drawers, modals, floating buttons
  - `--sh-cta: 0 8px 18px rgba(255,138,0,.35)`: orange CTA only
- **App shell:** a white sticky top bar (64 px) with the logo on the left, the main navigation in the middle, and the language switch (Рус / Қаз) and user menu on the right. The content sits on `--bg`. There is no sidebar in the MVP; the analysis flow is linear (Upload, Analysis, Results, Conclusion) and is shown by the stepper in the page header.

---

## 5. Signature patterns (from the reference site)

### 5.1 Blue hero band
A full-width `--grad-hero` block with soft radial highlights (`::before` / `::after` circles at 8 % white). It holds the page title in white and optionally a white card that overlaps its bottom edge by 48 px ("Остались вопросы?" pattern). Use it only on the Upload / start page and the Conclusion page.

### 5.2 Step cards with watermark numbers
White cards containing an icon tile, an eyebrow "ШАГ 01", a title and a description, with a huge faint number (`Шаг 01`, 64 px, `--kt-blue-50` colour) in the top-right corner. Cards are linked by a dotted vertical connector. Use them for the onboarding "how it works" section and for the analysis pipeline progress screen.

### 5.3 Ornament card header
A blue band header (48 px) with a repeating diamond (Kazakh ornament) pattern, a white bold title, and an optional orange "Акция"-style pill on the right. In OrgScope it headers **unit cards** in the comparison view: the unit name sits on the band, and the status pill (Создано / Реорганизовано…) sits on the right.

### 5.4 Icon tile
A 44 × 44 rounded square (`--r-md`) with `--grad-tile` and a white 22 px stroke icon. The small variant is 32 px. On white cards a soft variant uses a `--kt-blue-100` background with a blue icon.

### 5.5 Letter / filter chips
Round chips (32 px) in a row, with a pale grey background and the active one in solid blue ("Все А Б В…"). OrgScope uses them to filter the unit list by status or by finding type (with counters).

### 5.6 Info bar
A white pill-shaped bar with an icon tile on the left, a bold one-liner, and a CTA on the right ("Среднее время подключения — 1 день / Выбрать тариф"). OrgScope uses it for the summary bar under the results header ("Найдено 7 отклонений в 12 подразделениях / Сформировать заключение").

### 5.7 Floating round buttons
Scroll-to-top: a 44 px blue circle centred at the bottom of long pages. Optional help: a 52 px circle at the bottom right.

---

## 6. Components

All class names are defined in `components.css`. Use them as-is in Vue templates or wrap them in SFCs with the same names.

### 6.1 Buttons (`.btn`)
| Variant | Class | Look | When |
|---|---|---|---|
| Primary CTA | `.btn .btn-cta` | Orange gradient, white text, `--sh-cta` | One per screen |
| Primary | `.btn .btn-primary` | Solid `--kt-blue-600` | Main action inside a card |
| Secondary | `.btn .btn-outline` | White background, 1.5 px blue border, blue text | Alternative actions ("Тех. поддержка" style) |
| Ghost | `.btn .btn-ghost` | Transparent, blue text, `--kt-blue-100` on hover | Toolbar and inline actions |
| Danger | `.btn .btn-danger` | White background, red border and text | Destructive actions (remove file) |

Sizes: `.btn-sm` 32 px, default 40 px, `.btn-lg` 48 px. Radius `--r-sm`. Icon plus label with a 8 px gap. Disabled: 45 % opacity, no shadow. Focus: `0 0 0 3px rgba(30,136,255,.35)`.

### 6.2 Inputs
40 px height, white background, 1 px `--line-strong` border, `--r-sm` radius (the reference site uses a fully rounded input on orange; use `.input-pill` there). Focus: blue border plus focus ring. The label sits above in 13 px/600 `--ink-600`, and helper or error text sits below in 12 px. The search input has a leading icon. Checkboxes are 18 px, blue when checked, 4 px radius.

### 6.3 Cards
`.card`: white, `--r-lg`, `--sh-2`, 24 px padding, optional `.card-header` with a title plus a round icon button on the right ("Получить консультацию" style). `.card-accent` is the orange variant (`--grad-cta` background, white text) and is used at most once per page for a call to action.

### 6.4 Badges and pills
`.badge` is 24 px high, `--r-pill`, 12 px/700, with a tint background, solid text and a 14 px icon. Status badges: `.badge-created`, `.badge-kept`, `.badge-reorg`, `.badge-abolished`. Finding badges: `.badge-loss`, `.badge-dup`, `.badge-conflict`, `.badge-ok`.

### 6.5 Tables
A white container with `--r-md`, a 1 px `--line` border and `--sh-1`. The header row uses `--surface-muted` with 12 px uppercase `--ink-500` text. Rows are 48 px high, with 1 px `--line` separators, `--kt-blue-50` on hover and `--kt-blue-100` plus a 3 px left blue inset when selected. Numeric columns are right-aligned and tabular. Finding rows get a 3 px left border in the finding's solid colour.

### 6.6 Upload dropzone
A dashed 2 px `--line-strong` border, `--r-lg` radius, white background, 40 px padding and a centred icon tile. On drag-over the border turns `--kt-blue-500` and the background `--kt-blue-50`. It lists the accepted formats as small file-type chips: **DOCX** (blue), **PDF** (red), **XLSX** (green). There are always two zones side by side: **«До реорганизации»** and **«После реорганизации»**.

### 6.7 Progress and pipeline
- Linear progress: 6 px track in `--kt-blue-100`, blue gradient fill, rounded.
- Pipeline steps: the step card pattern (§5.2), where each step is *done* (green check tile), *running* (blue tile with spinner, pulsing border) or *pending* (grey tile).
- Page stepper (Загрузка · Анализ · Результаты · Заключение): numbered circles joined by a line. The active step is blue and filled, done steps are blue outlined with a check.

### 6.8 Advisory banner (mandatory, §9 of the task)
A light blue banner (`--kt-blue-50` background, 1 px `--kt-blue-100` border, `--r-md`) with an `info` icon:
> **Выводы носят рекомендательный характер.** Каждый вывод подтверждён фрагментом исходного документа и требует проверки ответственным сотрудником.

It appears at the top of Results, Finding detail and Conclusion, and in the exported report. It is not dismissible.

### 6.9 Source citation (mandatory, M4)
- **Source chip** `.src-chip`: a monospace-free pill with a document-type icon, the short document name and the clause (`Положение ДИТ · п. 3.4`). Clicking it opens the source panel.
- **Quote block** `.quote`: a 3 px left border in `--kt-blue-600`, `--surface-muted` background, the verbatim text in `PT Serif`, and a footer with the document name, page and clause. Highlight the matched phrase with `<mark>` (background `#FFF1C2`).
- A finding without a source must not be rendered. The frontend should treat a missing `sources[]` as an error state.

### 6.10 Finding card
It has a 4 px left border in the finding's colour, the finding badge, a title (the function name), a one-sentence explanation, the "до" vs "после" units, a confidence meter, source chips, and a "Подробнее" ghost button. Sort order: loss, then conflict, then duplication, then by confidence.

`.finding.f-info` is the fourth, informational variant (blue left border) for «Функция перераспределена» and «Примечание» cards. Low-importance cards (moved functions, overlaps of a general and a specific norm, notes) sit in a collapsed `<details class="finding-group">` under the main list, so the screen leads with losses, conflicts and duplications.

### 6.11 KPI tiles
A white card with an icon tile, a 36 px number and a 13 px label, plus an optional delta ("+2 к исходной структуре"). There are four in a row on Results: Подразделений до/после · Потери · Дублирования · Конфликты.

### 6.12 Empty, loading and error states
- Empty: a centred icon tile (64 px, soft), a title and one line of help with a primary button.
- Loading: skeleton blocks (`--surface-muted` with a shimmer), never spinners in tables.
- Error: a red-tinted banner with the cause and a "Повторить" button. Say what failed ("Не удалось прочитать PDF: файл защищён паролем"), not "Ошибка".

---

## 7. Iconography

Stroke icons in the Lucide style: 24 px grid, 1.75 px stroke, round caps and joins, `currentColor`. Sizes are 16 px inline, 20 px in buttons and 22 px in tiles. Do not mix in filled icons, except the brand logo and file-type badges. Use `src/Icon.vue`; the names match Lucide. To add an icon, add its path to `PATHS` there instead of adding an icon library.

---

## 8. Motion

- Durations: 120 ms (hover, press), 200 ms (dropdowns, tabs), 300 ms (drawers, modals).
- Easing: `cubic-bezier(.2,.8,.2,1)`.
- Hover lifts cards by `translateY(-2px)` and moves them from `--sh-2` to `--sh-3`, on clickable cards only.
- Respect `prefers-reduced-motion`: disable the lift, shimmer and pulse.

---

## 9. Content and language

- The UI language is Russian by default, with a Kazakh toggle (`Рус` / `Қаз`) in the header, as on the reference site. English is for code only.
- Write sentences in sentence case. UPPERCASE is only for eyebrows, table headers and the display hero title.
- Numbers use a thin space as the thousands separator (`1 250`), dates are `DD.MM.YYYY`, and document references follow `Приказ № 45-П от 12.03.2026, Прил. 2, п. 3.4`.
- Use hedged wording for findings: «возможная потеря», «признаки дублирования», «потенциальный конфликт интересов».

---

## 10. Accessibility

- Minimum hit target 40 × 40 px (32 px allowed for chips in dense toolbars).
- Every status is colour, icon and text together.
- The focus ring is always visible on keyboard focus (`:focus-visible`).
- Tables use `<th scope>`. The source panel is a proper dialog (`role="dialog"`, focus trap, closes on Esc).

---

## 11. Using it in the Vue app

1. Use the classes from `components.css` directly in templates (`class="btn btn-cta"`, `class="badge badge-loss"`). Put only screen-specific layout in `<style scoped>`, and build it from tokens (`var(--sp-4)`, `var(--r-lg)`), never raw hex values.
2. Icons: `<Icon name="…" />`. Extra classes pass through (`<Icon name="eye" class="icon-sm" />`).
3. When results screens are built, map the domain enums to classes in one place:

```js
export const UNIT_STATUS = {
  created:     { label: 'Создано',        cls: 'badge-created',   icon: 'plus-circle' },
  kept:        { label: 'Сохранено',      cls: 'badge-kept',      icon: 'check-circle' },
  reorganized: { label: 'Реорганизовано', cls: 'badge-reorg',     icon: 'shuffle' },
  abolished:   { label: 'Упразднено',     cls: 'badge-abolished', icon: 'minus-circle' },
};
export const FINDING_TYPE = {
  loss:        { label: 'Потеря функции',     cls: 'badge-loss',     icon: 'alert-octagon' },
  duplication: { label: 'Дублирование',       cls: 'badge-dup',      icon: 'copy' },
  conflict:    { label: 'Конфликт интересов', cls: 'badge-conflict', icon: 'scale' },
};
```

---

## 12. Screens built with it

| Component | Patterns used |
|---|---|
| `src/AuthPanel.vue` | Split auth screen: hero band with glass icon tiles (§5.1), white card with a segmented login/signup switch, inputs with leading icons and a show/hide password button, error alert (§6.12), orange CTA (§6.1) |
| `src/App.vue` | App shell with sticky white header (§4), API status pill, user avatar, page stepper (§6.7), advisory banner (§6.8), KPI tiles (§6.11), info bar (§5.6), results tabs |
| `src/components/UploadPanel.vue` | Two dropzones «До» / «После» with file-type chips (§6.6), file list, the one orange CTA «Анализировать» (§6.1) and an outline button for the control set |
| `src/components/ProgressBar.vue` | Linear progress and the five pipeline steps as done / running / pending tiles (§6.7) |
| `src/components/UnitsTable.vue` | Table (§6.5) with unit status badges (§2.3) and source chips (§6.9) |
| `src/components/MatchTable.vue` | Table with filter chips (§5.5), relation badges and source chips |
| `src/components/FindingCard.vue` | Finding card (§6.10): badge, title, explanation, units, quote blocks with source chips, advisory footer |
| `src/components/Conclusion.vue` | Markdown conclusion with the «Скачать .md» CTA |
| `src/components/ClausePanel.vue` | Dialog (§10) showing the full clause and its sub-items from the stored document |
