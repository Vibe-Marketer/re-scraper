# Reonomy Contact Scraper

A powerful TamperMonkey userscript that extracts property owner contact information from Reonomy saved searches. Export complete contact data including names, phone numbers, emails, and addresses to CSV format.

## Features

- **Complete Contact Extraction** - Captures all available contact data: names, phone numbers (up to 5 per contact), emails (up to 3 per contact), and mailing addresses
- **Smart Pagination** - Automatically processes all pages in your saved search, handling navigation seamlessly
- **Dual-Phase Scanning** - First scans the property page, then checks "View Contacts" drawer for additional data
- **Intelligent Deduplication** - Merges duplicate contacts and keeps the most complete information
- **Auto-Resume** - If the page reloads or you navigate away, scraping resumes automatically from where it left off
- **Real-Time Progress** - Visual progress bar and live status updates show exactly what's being captured
- **CSV Export** - One-click export to a clean, organized CSV file ready for your CRM or spreadsheet
- **LLC Filtering** - Automatically filters out corporate entities to focus on individual contacts
- **Persistent State** - All progress is saved locally, so you never lose data even if the browser crashes

## Installation

### Step 1: Install TamperMonkey Extension

1. **Chrome**: Install from [Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
2. **Firefox**: Install from [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
3. **Edge**: Install from [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)
4. **Safari**: Install from [Mac App Store](https://apps.apple.com/app/tampermonkey/id1482490089)

### Step 2: Enable Developer Mode (Important!)

TamperMonkey requires developer mode to be enabled for full functionality:

**Chrome:**
1. Go to `chrome://extensions/`
2. Enable **Developer mode** toggle in the top right corner

**Firefox:**
1. Go to `about:addons`
2. Click the gear icon and select **Debug Add-ons**
3. Enable **Enable add-on debugging**

**Edge:**
1. Go to `edge://extensions/`
2. Enable **Developer mode** toggle in the bottom left

### Step 3: Add the Script to TamperMonkey

1. Click the TamperMonkey icon in your browser toolbar
2. Select **Create a new script...**
3. Delete any default code in the editor
4. Copy the entire contents of `reonomy.js` from this repository
5. Paste it into the TamperMonkey editor
6. Press `Ctrl+S` (Windows) or `Cmd+S` (Mac) to save
7. The script is now installed and will activate on Reonomy pages

## Usage

### Getting Started

1. **Log in to Reonomy** - Navigate to [reonomy.com](https://reonomy.com) and sign in to your account

2. **Create or Open a Saved Search** - Go to a saved search with the properties you want to scrape. The URL should look something like:
   ```
   https://app.reonomy.com/!/search/results?saved_search_id=123456
   ```

3. **Copy the Search URL** - Copy the full URL from your browser's address bar

4. **Open the Scraper Panel** - Look for the orange **VIBECODERZ TITANIUM** panel at the top center of your screen. Click the minimize button to expand it if collapsed.

5. **Paste Your Search URL** - Paste your saved search URL into the **Search URL (Home Base)** field

6. **Configure Options** (optional):
   - **Job Name**: Give your scraping job a name (used for the exported CSV filename)
   - **Start Page**: Start from a specific page number (default: 1)
   - **Start Row**: Start from a specific row on the page (default: 1)
   - **Limit**: Set a maximum number of properties to scrape (leave blank for all)

7. **Click START** - The scraper will begin processing properties automatically

8. **Export Your Data** - When complete (or anytime during scraping), click **EXPORT CSV** to download your data

### Understanding the Interface

| Element | Description |
|---------|-------------|
| **Progress Bar** | Shows completion percentage for current batch |
| **Page/Row Counter** | Current page and row being processed |
| **Total Captured** | Running count of properties scraped |
| **Last Captured** | Name of most recently extracted contact |
| **START Button** | Begins the scraping process |
| **STOP Button** | Pauses scraping and exports current data |
| **Show Live Debug Logs** | Toggle detailed logging for troubleshooting |
| **Wipe Memory** | Clears all saved data and resets the scraper |
| **EXPORT CSV** | Downloads collected data as a CSV file |

### CSV Output Format

The exported CSV includes the following columns:

**Property Information:**
- `address_full` - Full property address
- `gross_building_area` - Building square footage
- `property_type` - Property classification
- `year_built` - Year of construction
- `sale_amount` - Last sale price
- `sale_recorded_date` - Date of last sale
- `reported_owner_table` - Owner name from table view
- `reported_llc_table` - LLC/company name if applicable

**Contact Information (per contact):**
- `contact_name` - Contact's full name
- `contact_phone_1` through `contact_phone_5` - Phone numbers
- `contact_email_1` through `contact_email_3` - Email addresses
- `contact_address` - Contact's mailing address

Multiple contacts per property are supported with numbered columns (e.g., `contact_2_name`, `contact_2_phone_1`, etc.)

See [`sample-output.csv`](sample-output.csv) for an example of the exported data format.

## Tips & Best Practices

### For Best Results

- **Use Saved Searches** - The scraper works best with saved search URLs, not manual searches
- **Start Small** - Test with a small batch (set Limit to 10-20) before running large jobs
- **Stable Connection** - Use a reliable internet connection to avoid interruptions

### Keep the Browser Tab Active (Important!)

Modern browsers will suspend inactive tabs to save resources. If the Reonomy tab gets suspended, the scraper will pause until you return to it.

**To prevent interruptions:**
- Keep the Reonomy tab **visible on your screen** while scraping
- **Don't switch to other tabs** or minimize the browser window
- If you need to do other work, use a **separate browser window** rather than switching tabs
- Consider using a dedicated browser profile just for scraping
- Disable any browser extensions that auto-suspend tabs (like "The Great Suspender")

**If the scraper pauses:**
Simply click back on the Reonomy tab - the scraper will automatically resume from where it left off thanks to the auto-save feature.

### Resuming Interrupted Sessions

If your scraping session is interrupted:

1. The scraper automatically saves progress after each property
2. Simply navigate back to your saved search URL
3. Paste the URL into the Search URL field
4. Set the **Start Page** and **Start Row** to resume from where you left off
5. Click START to continue

### Handling Large Lists

For lists with thousands of properties:

1. Consider breaking them into smaller batches using the **Limit** option
2. Export data periodically to avoid losing progress
3. Use the **Start Page** option to process different page ranges in separate sessions

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Panel not appearing | Refresh the page and wait 2-3 seconds |
| Script not running | Check TamperMonkey is enabled and the script is active |
| No contacts found | Some properties may not have contact data available |
| Scraper stuck | Click STOP, refresh the page, and restart from the last completed row |
| Export shows no data | Ensure at least one property has been processed |

### Debug Mode

Enable **Show Live Debug Logs** to see detailed information about:
- Which properties are being processed
- Contact data being extracted
- Any errors or issues encountered
- Phase 1 (page scan) and Phase 2 (drawer scan) results

## Technical Details

- **Version**: 3.3.0
- **Compatibility**: Works on all `*.reonomy.com` domains
- **Data Storage**: Uses TamperMonkey's GM_setValue/GM_getValue for persistent storage
- **No External Requests**: All data processing happens locally in your browser

## Disclaimer

This tool is intended for legitimate use with your own Reonomy account. Ensure your use complies with Reonomy's Terms of Service and applicable data privacy regulations. The developers are not responsible for misuse of this tool.

## License

This project is licensed under the **Creative Commons Attribution-NonCommercial 4.0 International License (CC BY-NC 4.0)**.

**You are free to:**
- Share and redistribute the software
- Modify and adapt the software for personal use

**Under these conditions:**
- **Attribution** - You must give appropriate credit to VibeCoderz
- **NonCommercial** - You may NOT use this software for commercial purposes, including selling, paid services, or commercial distribution

See the [LICENSE](LICENSE) file for full details.

---

**Built by VibeCoderz** | Version 3.3.0
