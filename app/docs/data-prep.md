# Data Preparation Checklist

Use this guide when onboarding real labor/material spreadsheets from Sathi.

## 1. Normalize Labor Rates
1. Duplicate the raw spreadsheet and remove unrelated columns.
2. Keep the following headers (case-insensitive):
   - `Trade` – plain-language description (e.g., `Tile Flooring`).
   - `Labor_Type` – `Prevailing Wage`, `Union`, etc.
   - `Hourly_Cost` – numeric USD.
   - Optional: `Crew_Size`, `Notes`.
3. Export as CSV (UTF-8) and upload via **Admin → Labor Rates**.

## 2. Normalize Material Prices
1. Combine vendor price lists into one sheet.
2. Columns required:
   - `Item_Name`
   - `Unit` (LF, SF, EA, LS)
   - `Cost_Per_Unit`
   - Optional: `Full_Description`, `Vendor`
3. Export as CSV and upload via **Admin → Material Prices**.

## 3. Takeoff / BOQ Template
- Required columns: `Description`, `Unit`, `Qty`.
- Optional: `Labor_Type` (defaults to Prevailing Wage when omitted).
- Keep descriptions consistent with material/labor naming to improve matching.

## 4. QA Checklist
- Spot-check a random sample after upload (table view renders latest data).
- Use the `scripts/mockWorkflow.js` runner in this repo to simulate pricing with the freshly uploaded sheets before using the UI.

## 5. Testing with Real Project
1. Create a project in the app.
2. Upload the real BOQ.
3. Review mismatched lines (flagged in red) and update the source spreadsheets if needed.
4. Export the Excel file and compare to Sathi's manual estimate for validation.
