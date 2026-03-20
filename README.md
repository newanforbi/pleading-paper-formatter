# Pleading Paper Formatter

**Live app:** https://newanforbi.github.io/pleading-paper-formatter

Browser-based PDF generator for California state-court filings. No installation, no server, no account. Open the page, fill in your case details, and download court-ready PDFs.

---

## What it generates

### Pleading Paper
A multi-page California pleading paper PDF conforming to California Rules of Court:
- Double vertical ruling lines on the left margin, single rule on the right
- Line numbers 1–28 on every page
- Two-column caption block (parties on left, case number and document type on right)
- Auto-formatted body text — headers, paragraphs, and list items detected automatically
- Footer on every page with page number and document title

### Certificate of Service
An AG-style Certificate of Service PDF:
- Two-column case identification header (Case Name / No.)
- Service statement with configurable service date
- Bold document list
- Recipient address blocks
- Perjury declaration with execution date and city
- Signature line

---

## How to use

1. **Case Profile tab** — Fill in your name, contact info, address, court, case number, respondents, document type, and footer title. This data populates both documents automatically. You only fill it once.

2. **Pleading Paper tab** — Paste or type your document body. Click **Generate PDF** to download.

3. **Certificate of Service tab** — Fill in service date, documents served, recipients, and signer info. Click **Generate PDF** to download.

Switching tabs does not clear any data.

---

## Auto-format rules

The pleading paper body textarea accepts plain text. Lines are classified automatically:

| Input | Output in PDF |
|---|---|
| Line where all significant words are ALL CAPS | Centered bold header, blank line above and below |
| Line starting with `1.` `1)` `(a)` `•` `-` `*` | List item, indented 36pt |
| Everything else | Paragraph, 36pt first-line indent |

Consecutive paragraph lines are joined into a single reflowable block before word-wrapping.

**Example input:**
```
I. JURISDICTION AND VENUE

1. This Court has jurisdiction pursuant to California Penal Code section 1473(a).

Petitioner respectfully submits the following argument in support of the writ.
```

**Renders as:**
- `I. JURISDICTION AND VENUE` → centered bold header
- `1. This Court has…` → list item
- `Petitioner…` → paragraph with first-line indent

---

## Case Profile fields

| Field | Used in |
|---|---|
| Plaintiff / Petitioner Full Name | Both PDFs — pleading header, caption, COS case name |
| Phone | Pleading paper header |
| Email | Pleading paper header |
| Home / Business Address | Pleading paper header and caption left column |
| Petitioner Label | Pleading paper header (e.g. *Petitioner, In Propria Persona*) |
| Court Name | Pleading paper centered court line, COS court line |
| County | Pleading paper court line, COS court line |
| Case Number | Caption right column, COS No. field |
| Respondents / Defendants | Caption left column |
| Document Type | Caption right column (enter one line per entry, e.g. `PETITION FOR WRIT` / `OF HABEAS CORPUS`) |
| Footer Title | Footer on every page of the pleading paper |

---

## Technical notes

- **PDF generation:** [pdf-lib](https://pdf-lib.js.org/) v1.17.1, loaded from CDN. Runs entirely in the browser — no data leaves your device.
- **Fonts:** Times Roman, Times Roman Bold (body), Helvetica (line numbers and footer) — standard PDF fonts, no embedding overhead.
- **Page size:** US Letter (8.5 × 11 in / 612 × 792 pt).
- **Layout constants** match the California pleading paper standard:
  - Left double rule at 1.30 in / 1.35 in from left edge
  - Content starts at 1.45 in from left edge
  - Right rule at 8.0 in from left edge (0.5 in right margin)
  - 28 lines per page, 24pt line spacing
  - Text starts 1.05 in from top

---

## Running locally

No build step required. Open `index.html` directly in any modern browser:

```
open index.html          # macOS
start index.html         # Windows
xdg-open index.html      # Linux
```

Or serve with any static file server:

```
npx serve .
python3 -m http.server
```

---

## Files

```
index.html   — HTML structure and tab layout
styles.css   — Legal-industrial design system (cream/parchment, serif, ruled)
app.js       — All application logic: state, auto-format engine, PDF generators
README.md    — This file
```
