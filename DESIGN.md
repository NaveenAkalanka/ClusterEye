---
name: ClusterEye
description: A quiet, exact record of one person's lab infrastructure.
colors:
  lab-sage: "#a8c9ad"
  lab-sage-light: "#bdd9c1"
  on-sage: "#081009"
  brass: "#d6b77a"
  clay: "#e29189"
  danger-red: "#c10007"
  night-moss: "#070a08"
  moss-panel: "#0b100c"
  moss-field: "#0e1410"
  moss-raised: "#172019"
  moss-raised-hover: "#1f2a22"
  field-edge: "#626e65"
  hairline: "rgb(168 201 173 / 0.11)"
  hairline-strong: "rgb(168 201 173 / 0.2)"
  chalk: "#ffffff"
  cluster-default: "#22c55e"
typography:
  display:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.11
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.56
  card-title:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
  data:
    fontFamily: "Roboto Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  data-stat:
    fontFamily: "Roboto Mono, ui-monospace, monospace"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1
rounded:
  map-cell: "1px"
  chip: "4px"
  md: "6px"
  control: "8px"
  panel: "12px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.lab-sage}"
    textColor: "{colors.on-sage}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.lab-sage-light}"
  button-secondary:
    backgroundColor: "{colors.moss-raised}"
    textColor: "{colors.chalk}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  button-secondary-hover:
    backgroundColor: "{colors.moss-raised-hover}"
  button-danger:
    textColor: "{colors.clay}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  button-danger-solid:
    backgroundColor: "{colors.danger-red}"
    textColor: "{colors.chalk}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  input:
    backgroundColor: "{colors.moss-field}"
    textColor: "{colors.chalk}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  record-row:
    backgroundColor: "{colors.moss-raised}"
    textColor: "{colors.chalk}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "48px"
  record-row-hover:
    backgroundColor: "{colors.moss-raised-hover}"
  panel:
    backgroundColor: "{colors.moss-panel}"
    rounded: "{rounded.panel}"
    padding: "16px"
  stat-card:
    backgroundColor: "{colors.moss-raised}"
    rounded: "{rounded.control}"
    padding: "12px"
---

# Design System: ClusterEye

## Overview

**Creative North Star: "The Lab Ledger"**

ClusterEye is a careful record book kept by one person for their own lab, opened when they need to know what runs where, or when they are about to change something. It should feel quiet, exact, and trustworthy. Dark moss surfaces stay out of the way, and a single sage accent marks what you can act on. The numbers, names, and addresses are the content; everything else recedes around them.

A ledger records; it does not monitor. Nothing in this system may look live, measured, or current unless it is, so there are no pulsing dots, status glows, or telemetry flourishes. Trust comes from precision instead: IPs in a monospace face, consistent columns, plain language about what is unknown, and rows that line up the same way on every page.

Density is moderate and task-led. Screens are built for fast lookup and low-effort upkeep, with controls in one predictable sidebar and the records beside it. Components are quiet and precise: restrained surfaces and thin edges, with colour saved for the main action and for state.

**Key Characteristics:**
- Dark only, with moss-tinted neutrals rather than pure greys.
- One accent, Lab Sage, reserved for primary actions, current state, and recorded data.
- Depth from tonal steps and hairlines, with shadows only on what floats.
- Outfit for words, Roboto Mono for values.
- Every record looks and behaves the same across pages.
- On each load the ledger fills in: panels, then records, then charts.

## Colors

A green-tinted near-black ramp carries the interface, with one soft sage accent and two warm signals for things needing attention.

### Primary
- **Lab Sage**: The one accent. Primary buttons, the selected tab, current navigation, focus rings, map cells with a recorded address, and capacity bars below the caution threshold.
- **Lab Sage Light**: Hover state of sage controls only.
- **On Sage**: Text and icons on sage fills. Never put white on sage.

### Secondary
- **Brass**: Caution. Disks at or above 85% allocated, unknown hosts, and Inventory Checks that need a look.
- **Clay**: Errors and destructive intent. Duplicate or invalid IPs, form errors, and the Delete action before it is confirmed. Its tinted text variants (`#f0b8b2` on Clay, `#e8d3a6` on Brass, `#cfe3d2` on Sage) are for alert body copy.
- **Danger Red**: The final confirm button of an irreversible delete, and nothing else.

### Neutral
- **Night Moss**: The canvas behind everything, with two very faint radial tints (sage top-left, clay bottom-right).
- **Moss Panel**: Cards, sidebars, the navbar, and dialogs.
- **Moss Field**: Input and select backgrounds.
- **Moss Raised** and **Moss Raised Hover**: Records, stat cards, secondary buttons, and menus sitting on a panel.
- **Field Edge**: The border of inputs and selects, set to meet the 3:1 minimum for control boundaries.
- **Hairline** and **Hairline Strong**: Quiet borders and dividers. Hairlines are for grouping, never the only edge of an input.
- **Chalk**: Primary text. Secondary text is Chalk at reduced opacity, never below the 4.5:1 minimum.

### Data Colors
- **Cluster colors**: Each cluster's colour is the owner's choice from a set of 20 swatches. These appear as small dots, bars, and the Nodes by Cluster map, and they are data rather than theme.
- **Cluster Default**: The Green swatch, used as the starting swatch for a new cluster and the fallback for records with no colour (`DEFAULT_CLUSTER_COLOR` in `src/utils/format.js`). Clusters saved earlier keep the colour they were given.

### Named Rules
**The One Accent Rule.** Sage marks what you can act on and what is selected. If it appears on something inert, remove it.

**The Signal Rule.** Brass and Clay only ever mean something needs attention. They are never decoration, and they always come with words or an icon, never colour alone.

**The Visible Step Rule.** A record must be visibly distinct from its panel: a solid Moss Raised fill plus a hairline. Translucent fills that blend into the panel don't count.

## Typography

**Display Font:** Outfit (with system-ui, sans-serif)
**Body Font:** Outfit (with system-ui, sans-serif)
**Label/Mono Font:** Roboto Mono (with ui-monospace, monospace)

**Character:** Outfit is a clean geometric sans that keeps the interface friendly and uncluttered. Roboto Mono handles anything you might compare or copy, so its columns line up and its digits read exactly.

### Hierarchy
- **Display**: The empty-dashboard welcome only (30px on phones, 36px from 768px).
- **Headline**: Page-level overview titles, such as Infrastructure Overview and Account Settings.
- **Title**: Inventory page names and dialog titles.
- **Card Title**: Headings on dashboard cards. Account Settings section headings use Body at weight 600.
- **Body**: Row content, descriptions, buttons (weight 600), and form values. Keep running text to about 65ch.
- **Label**: Field labels, column headers, card subtitles, and stat names. This is the smallest routine size; 11px appears only on the free-space hint in disk menus and the "nodes" caption on the cluster map, and should not spread.
- **Data**: IPs, IDs, subnet masks, sizes, and ports, usually at 12px or 14px. Every numeral uses tabular figures.
- **Data Stat**: The large value on stat tiles. Sidebar lead stats use 24px, and the node donut's total uses 30px.

### Named Rules
**The Values Are Mono Rule.** Anything measured, addressed, or identified is Roboto Mono. Names, labels, and sentences are Outfit. Mono is never used as a "technical" decoration on words.

**The Title Case Rule.** Labels, headings, and buttons use Title Case; sentences use sentence case. Case is written in the copy, never applied with uppercase styling or wide tracking.

## Layout

Every signed-in page sits in one frame: a 64px navbar with content directly below it, sharing exactly the same left and right edges. Side margins scale with the screen (12px on phones, 16px from 640px, 24px from 1280px, 32px from 1536px, 40px from 1920px, 56px from 2560px), while top and bottom stay at 16px (12px on phones). Content uses the full frame width, except Account Settings, whose forms are capped at 1152px and centred.

Inventory pages share one layout: a 288px sidebar with the page title, search, primary action, and summary, then the record list filling the remaining space. On desktop each column scrolls on its own. Below 1024px the sidebar stacks above the list, and on phones its stats hide so the records come first.

The dashboard uses a 12-column grid with three rows: a full-width overview, then Inventory Checks (3), Nodes by Type (4), and Nodes by Cluster (5), then three equal cards (4 each). From 1024px wide the rows share the window height, and long lists scroll inside their own card. Below 1280px the middle row becomes equal columns.

Record tables on Nodes, Clusters, Disks, and Docker are grids from 1280px and become cards below it, because IP addresses must never be truncated. Network has fewer columns, so its table holds until 768px. Spacing rhythm uses 8, 12, and 16px inside groups, with 16px between panels.

## Elevation & Depth

Depth comes mainly from tonal steps: Night Moss, then Moss Panel, then Moss Raised. Panels add a hairline and a soft resting shadow. Real shadows are reserved for things that float above the page, such as dialogs, menus, and toasts. There is no blur or glass; a dialog separates from the page with a 70% black scrim.

### Shadow Vocabulary
- **Panel rest** (`box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.025), 0 10px 28px rgb(0 0 0 / 0.12)`): Cards, sidebars, and the navbar.
- **Dialog** (`box-shadow: 0 24px 80px rgb(0 0 0 / 0.55)`): Modal dialogs.
- **Select menu** (`box-shadow: 0 18px 48px rgb(0 0 0 / 0.55)`): Dropdown menus for selects.
- **Overlay** (`box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25)`): The account menu, mobile drawer, and toasts.

### Named Rules
**The Only Floaters Cast Shadows Rule.** Records and controls on a panel stay flat. If it doesn't float over other content, it doesn't get a strong shadow.

## Shapes

Corners are gently curved and step down with scale: panels and dialogs at 12px, controls and records at 8px, small chips at 4px, and map cells nearly square at 1px. Only cluster dots, capacity bars, and the node donut are fully round. Edges are thin 1px lines, never heavy or coloured side stripes.

## Components

### Buttons
Quiet and precise, with one clear primary per view.
- **Shape:** Gently curved (8px), 40px tall, 14px weight 600.
- **Primary:** Solid Lab Sage with On Sage text, for the main action of a view or dialog.
- **Secondary:** Moss Raised with a hairline, for Cancel, Edit, and supporting actions.
- **Danger:** Clay text on a faint Clay tint, for starting a delete. It sits at the far left of a dialog footer, away from Edit.
- **Danger Solid:** Danger Red with white text, only for the final confirm.
- **Icon:** 40px square secondary style with a tooltip. When a filter is active, it gains a sage edge, sage icon, and a small dot.
- **States:** Hover shifts one tonal step, press moves down 1px, focus shows a 2px sage outline, and disabled drops to 50% opacity.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** Moss Panel with one faint sage radial tint at the top right.
- **Shadow Strategy:** Panel rest (see Elevation & Depth).
- **Border:** Hairline.
- **Internal Padding:** 16–20px. Dashboard cards have a darker header band with an icon, title, one-line subtitle, and a small arrow link.

### Inputs / Fields
- **Style:** Moss Field fill with a Field Edge border, 8px corners, 40px tall (44px on login), and a visible label above.
- **Focus:** The border turns full Lab Sage, with the 2px focus outline.
- **Read-only:** In view mode a field loses its fill and border and reads as selectable text, so an IP can always be copied. Never use disabled inputs for viewing.
- **Errors:** A single alert at the top of the form names the problem and the fix.
- **Selects:** Same treatment as inputs, with a caret. The menu is a Moss Raised panel with a check on the selected item.

### Navigation
- **Style:** A full-width panel with the logo on the left, centred links with icons at 12px weight 500, and an initial avatar on the right that opens the account menu.
- **Current page:** A faint sage tint, a stronger hairline, and a sage underline.
- **Mobile:** Below 1200px, links move to a left drawer behind a menu button. It closes with the backdrop or Esc.

### Record Row
The signature pattern. Each record is a 48px solid Moss Raised row with a hairline, aligned to sortable column headers. The whole row opens the record, unless text is being selected, and a small sage arrow provides the keyboard path. Hover moves one tonal step and strengthens the hairline. On smaller screens it becomes a card with the same fields.

### Dialogs
One shared shell: a header with the title and a close icon, a scrolling body, and a fixed footer. Focus starts on the first editable field, or the footer when viewing. Closing with unsaved edits asks first, and only filter dialogs close on a backdrop click.

### Subnet Map
A 16×16 grid of near-square cells for one /24, with recorded addresses filled in Lab Sage and hovering naming the node. It always appears with a note that other addresses haven't been checked.

### Motion
Motion explains loading and arrival, and it never holds up the task. On a reload, refresh, or route change, panels rise in (280ms with a 45ms stagger), records follow (240ms with a 24ms stagger, capped after the ninth), and charts draw last: bars grow, the donut sweeps, cluster tiles unfold, and recorded map cells light in address order. Everything uses a decelerating ease, and content is visible by default if an animation never runs. Live data updates don't replay entrances, so only a new record animates. With reduced motion on, movement and chart drawing are replaced by short fades.

**Loading:** A reload shows the dark canvas and a thin sage bar immediately, from inline styles. Lists and dashboards use skeletons with a soft shimmer, which wait 120ms before appearing so fast loads don't flicker.

### Alerts
A 1px tinted border and a faint tinted fill, with an icon and a sentence. Tone comes from Clay, Brass, or Sage. Saved confirmations on Account Settings appear as a dismissible toast rather than a blocking dialog.

## Do's and Don'ts

### Do:
- **Do** use the theme tokens for every interface colour; only cluster colours stay inline.
- **Do** keep the navbar and page content on exactly the same left and right edges.
- **Do** show values in Roboto Mono with tabular figures, and keep IP addresses untruncated.
- **Do** say plainly when something is unknown, such as "Other addresses haven't been checked and may be in use."
- **Do** give every control hover, focus, disabled, and loading states, and every list an empty state with a next step.
- **Do** keep text at 4.5:1 or better, and input and select borders at 3:1 or better.
- **Do** use Brass from 85% allocated, the same threshold on every page.

### Don't:
- **Don't** add pulsing dots, glows, "live" labels, or anything else implying measured or current status.
- **Don't** add small uppercase eyebrow labels above headings, or apply uppercase styling or wide tracking to labels.
- **Don't** use decorative grid-line backgrounds; the only grid here is the Subnet Map, which is real data.
- **Don't** use gradients on buttons or borders, or blur behind dialogs.
- **Don't** make anyone wait for motion: all panels should begin arriving within about 300ms, and charts should finish within about a second. No bounce, parallax, or looping effects outside loading states.
- **Don't** use translucent row fills that blend into the panel, or borders below 3:1 as an input's only edge.
- **Don't** use disabled inputs to display values, because they can't be reliably selected or copied.
