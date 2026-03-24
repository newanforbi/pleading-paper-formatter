# Pleading Paper Formatter

**Live app:** https://pleading-paper-formatter.vercel.app

Browser-based PDF generator for California state-court and federal-court filings, built for self-represented (pro se / in propria persona) litigants. No installation, no server, no account, no data upload. Everything runs in your browser.

---

## What it generates

### 1. Pleading Paper
A multi-page California pleading paper PDF conforming to California Rules of Court:
- Double vertical ruling lines on the left margin, single rule on the right
- Line numbers 1–28 on every page
- Two-column caption block (parties / contact on left, case number and document type on right)
- Auto-formatted body text — headers, paragraphs, and numbered list items detected and styled automatically
- Footer on every page with page number and document title

### 2. Declaration
A sworn declaration in support of a motion, formatted on pleading paper:
- Auto-prepends the opening line: *"I, [Name], declare:"*
- User types the numbered paragraphs of the declaration body
- Auto-appends the full perjury clause: *"I declare under penalty of perjury under the laws of the State of California that the foregoing is true and correct."*
- Execution date, city, and declarant signature block appended automatically
- Pulls all case caption data from Case Profile

### 3. \[Proposed\] Order
A proposed order for the judge to sign, formatted on pleading paper:
- User types the order language (e.g. *"IT IS HEREBY ORDERED that..."*)
- Auto-appends *"IT IS SO ORDERED."*, a dated signature line, and the judge's name and title
- Caption populated from Case Profile

### 4. Certificate of Service
A letter-format Certificate of Service:
- Service date, execution date, and execution location fields
- Configurable list of documents served
- Recipient address blocks (one per blank-line-separated entry)
- Perjury declaration and declarant signature block

### 5. Proof of Service by Mail
A formal Proof of Service by Mail with numbered declaration paragraphs:
- Includes statutory language for service by first-class mail under CCP 1013
- Same field structure as Certificate of Service, separate data

### 6. Deadline Calculator
A filing-deadline utility — no PDF output:

**Hearing Date → Deadlines** (enter your hearing date, get back):

| Jurisdiction | Opposition due | Reply due | Serve opposition by mail by |
|---|---|---|---|
| CA Superior Court (CRC 3.1300) | 9 court days before | 5 court days before | 2 court days before opposition filing date |
| US District Court (FRCP) | 14 calendar days before | 7 calendar days before | 3 calendar days before opposition filing date |

Court days exclude weekends and all CA/federal observed holidays (fixed holidays + floating: MLK Day, Presidents Day, Memorial Day, Labor Day, Thanksgiving, Day after Thanksgiving).

**Add Days to a Date**: enter any start date + number of days (calendar or court) → get the resulting date.

---

## How to use

### Step 1 — Fill in Case Profile
Open the **Case Profile** tab and fill in your information once. Everything entered here — your name, address, phone, email, court, county, case number, respondents, and document type — automatically populates all document tabs. You never re-enter your case information.

### Step 2 — Generate documents

| Tab | What to do |
|---|---|
| **Pleading Paper** | Type or paste your motion/brief body. Use the format toolbar for headers and list items. Download or preview. |
| **Declaration** | Enter the declaration title (e.g. *IN SUPPORT OF MOTION TO QUASH*), type numbered paragraphs, fill in execution date/city. Download or preview. |
| **\[Proposed\] Order** | Enter the order title and body language. Optionally fill in judge name/title. Download or preview. |
| **Certificate of Service** | Fill in service date, documents served, and recipients. Download or preview. |
| **Proof of Service** | Same as Certificate, separate fields. Download or preview. |
| **Deadlines** | Enter a hearing date or a start date + day count. Results appear instantly. |

**Switching tabs does not clear any data.** All fields save automatically to your browser's local storage and restore on next visit.

---

## Case Profile fields

| Field | Used in |
|---|---|
| Plaintiff / Petitioner Full Name | All PDFs — caption, header, signature blocks |
| Phone | Pleading paper left-column header |
| Email | Pleading paper left-column header |
| Home / Business Address | Pleading paper left-column header and caption |
| Petitioner Label | Beneath name in header (e.g. *Petitioner, In Propria Persona*) |
| Court Name | Centered court line in all captions |
| County | Court line in all captions |
| Case Number | Caption right column, service documents |
| Respondents / Defendants | Caption left column |
| Document Type | Caption right column — one line per entry (e.g. `PETITION FOR WRIT` on line 1, `OF HABEAS CORPUS` on line 2) |
| Footer Title | Footer text on every page of all pleading-format PDFs |

---

## Body text formatting (Pleading Paper and Declaration)

The body textarea accepts plain text. Lines are classified automatically:

| Input | Output in PDF |
|---|---|
| Line where all significant words are ALL CAPS | Centered bold header, blank line above and below |
| Line starting with `1.` `1)` `(a)` `•` `-` `*` | List item with 36pt indent |
| Everything else | Paragraph with 36pt first-line indent |

Consecutive paragraph lines are joined into a single reflowable block before word-wrapping.

**Format toolbar shortcuts** — select text, then click:
- **Header** — converts selection to ALL CAPS
- **List Item** — prefixes each selected line with a counter (`1.`, `2.`, …)
- **Paragraph** — strips list prefixes

**Example input:**
```
I. JURISDICTION AND VENUE

1. This Court has jurisdiction pursuant to California Penal Code section 1473(a).

Petitioner respectfully submits the following argument in support of the writ.
```

**Renders as:**
- `I. JURISDICTION AND VENUE` → centered bold header
- `1. This Court has…` → numbered list item, indented
- `Petitioner…` → paragraph with first-line indent

The line counter below the textarea shows the estimated PDF line count and page count so you can gauge length before generating.

---

## Named profiles (save / load / export)

The profiles bar at the top of Case Profile lets you save and restore complete case setups:

- **Save As** — name and save the current Case Profile fields as a named profile
- **Load** — restore all Case Profile fields from a saved profile
- **Duplicate** — copy a saved profile under a new name
- **Delete** — remove a saved profile
- **Export JSON** — download a single profile as a `.json` file (back it up or move it to another device)
- **Export All** — download all saved profiles as a single `.json` file
- **Import JSON** — load a profile from a `.json` file exported previously

Profiles are stored in browser local storage. They are not synced to any server.

---

## Preview

Every document tab has a **Preview** button that renders the PDF into an embedded viewer without downloading. Once the preview pane is open, it refreshes automatically as you type (700 ms debounce). Click **Preview** again or navigate away to close it.

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + G` | Download PDF for the active document tab |
| `Ctrl/Cmd + Shift + S` | Save current profile |

---

## Technical notes

- **PDF generation:** [pdf-lib](https://pdf-lib.js.org/) v1.17.1, loaded from CDN. Runs entirely in the browser — no data leaves your device.
- **Fonts:** Times Roman and Times Roman Bold (body text), Helvetica (line numbers, footer) — standard PDF built-in fonts, no embedding overhead.
- **Page size:** US Letter (8.5 × 11 in / 612 × 792 pt).
- **Offline support:** A service worker caches all assets after first load. The app works offline once cached.
- **Storage:** All field data and named profiles are stored in `localStorage`. Nothing is transmitted anywhere.
- **Pleading paper layout constants** match the California standard:
  - Left double rule at 1.30 in / 1.35 in from left edge
  - Content starts at 1.45 in from left edge
  - Right rule at 8.0 in from left edge
  - 28 lines per page, 24 pt line spacing
  - Text starts 1.05 in from top

---

## Running locally

No build step. Open `index.html` directly in any modern browser:

```
open index.html          # macOS
start index.html         # Windows
xdg-open index.html      # Linux
```

Or serve with any static file server (required for the service worker to register):

```
npx serve .
python3 -m http.server
```

---

## Files

```
index.html   — HTML structure and all tab layouts
styles.css   — Early 2000s / Windows 98-era UI design system
app.js       — All application logic: state, format engine, PDF generators, deadline calculator
sw.js        — Service worker for offline-first caching
README.md    — This file
```
