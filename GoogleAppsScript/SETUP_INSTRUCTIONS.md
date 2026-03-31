# Training Plan Uploader - Google Apps Script Setup

This guide will help you set up the Training Plan Uploader directly in your Google Sheets. Once set up, you can upload your training plan to intervals.icu with a single click!

---

## What You'll Need

1. A Google account
2. Your training plan spreadsheet in Google Sheets
3. Your intervals.icu account with:
   - Athlete ID
   - API Key

---

## Step 1: Get Your intervals.icu Credentials

1. Go to [intervals.icu](https://intervals.icu) and log in
2. Click the **Settings** gear icon (⚙️) in the top right
3. Scroll down and click **Developer Settings**
4. Note your **Athlete ID** (shown at the top, looks like `i12345`)
5. Click **Create API Key** to generate a new key
6. **Copy and save this API key** - you'll need it in Step 3

---

## Step 2: Add the Script to Your Spreadsheet

1. Open your training plan spreadsheet in Google Sheets
2. Click **Extensions** in the menu bar
3. Click **Apps Script**

   ![Extensions Menu](https://i.imgur.com/placeholder.png)

4. This opens the Apps Script editor in a new tab
5. **Delete** any existing code in the editor (select all and delete)
6. Open the `Code.gs` file from this folder
7. **Copy ALL the code** from `Code.gs`
8. **Paste** it into the Apps Script editor
9. Click the **Save** button (💾) or press `Ctrl+S` / `Cmd+S`
10. Give your project a name like "Training Plan Uploader" when prompted

---

## Step 3: Authorize the Script

1. Close the Apps Script editor tab
2. **Refresh** your spreadsheet page (F5 or Cmd+R)
3. Wait a few seconds - you should see a new **"Training Plan"** menu appear
4. Click **Training Plan → Settings**
5. Google will ask you to authorize the script:
   - Click **Continue**
   - Select your Google account
   - Click **Advanced** (at the bottom)
   - Click **Go to Training Plan Uploader (unsafe)**
   - Click **Allow**
6. The Settings dialog will now open
7. Enter your **Athlete ID** and **API Key** from Step 1
8. Click **Save Settings**

---

## Step 4: Upload Your Training Plan

1. Make sure your spreadsheet follows the expected format (see below)
2. Click **Training Plan → Upload to intervals.icu**
3. Review the preview of events
4. Click **Yes** to confirm the upload
5. Done! Check intervals.icu to see your training plan

---

## Menu Options

| Menu Item | Description |
|-----------|-------------|
| **Upload to intervals.icu** | Upload all events from your training plan |
| **Upload Specific Week...** | Upload only a specific week (enter week number) |
| **Preview Events (Dry Run)** | See what would be uploaded without actually uploading |
| **Settings** | Configure your intervals.icu credentials |
| **Help** | View help and format information |

---

## Expected Spreadsheet Format

Your training plan should follow this structure:

```
| A | B              | C (Mon)      | D (Tue)      | E (Wed)      | ... |
|---|----------------|--------------|--------------|--------------|-----|
|   | Week 1 22 Dec - 28 Dec |       |              |              |     |
|   | Activity       | Rest         | 45 min Easy  | 5x3:00 (60s) Z4 | ... |
|   | Purpose        |              | Base         | VO2max       | ... |
|   | Session Notes  |              |              | Interval session: ... | ... |
```

### Key Requirements:
- **Week headers**: Must contain "Week" and a date range (e.g., "Week 1 22 Dec - 28 Dec")
- **Activity row**: Label in column B must be "Activity"
- **Days**: Columns C through I represent Monday through Sunday
- **Rest days**: Enter "Rest" or leave blank

### Supported Workout Formats:

| Format | Example |
|--------|---------|
| Recovery run | `30 mins Recovery` |
| Easy run | `45 mins Easy` |
| Easy with strides | `40 mins Easy & Strides 5x10sec + 50sec rest` |
| Long run | `90 mins Long Run` |
| Long run with intervals | `90 mins Long Run + 3x5 mins Z3` |
| Intervals | `5x3:00 (60s) Z4` |
| Hills | `10x3:00 hills Z3` |
| Progression | `12 km Progression` |
| With strength | `45 min Easy and Strength` |

---

## Troubleshooting

### "Training Plan" menu doesn't appear
- Refresh the page and wait 5-10 seconds
- Make sure you saved the script in Apps Script
- Try closing and reopening the spreadsheet

### "Please configure your settings first" error
- Click Training Plan → Settings and enter your credentials

### "Authorization required" popup
- Follow the authorization steps in Step 3 above
- You may need to click "Advanced" → "Go to ... (unsafe)"

### Upload fails with error
- Check your Athlete ID and API Key are correct
- Make sure you have an active intervals.icu account
- Try uploading a smaller batch (single week) first

### Events not appearing correctly
- Check your spreadsheet follows the expected format
- Make sure week headers include dates (e.g., "22 Dec - 28 Dec")
- Verify "Activity" is spelled correctly in column B

---

## Privacy & Security

- Your API key is stored securely in your Google account's user properties
- The script only has access to the current spreadsheet
- No data is sent anywhere except to intervals.icu
- You can revoke the script's access anytime in your Google Account settings

---

## Need Help?

If you encounter issues:
1. Use **Training Plan → Preview Events** to check what the script sees
2. Verify your spreadsheet format matches the examples above
3. Check the intervals.icu API documentation for any changes

---

Happy Training! 🏃‍♂️
