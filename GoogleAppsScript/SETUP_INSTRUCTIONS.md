# Coach Training Plan Uploader - Setup Guide

Manage training plans for multiple athletes from one Google Sheet. Push workouts to each athlete's intervals.icu calendar (and their Garmin) using your single coach API key.

---

## What You'll Need

1. A Google account
2. Your training plan spreadsheet in Google Sheets
3. Your intervals.icu **coach** account with an API key

---

## Step 1: Get Your Coach API Key

1. Go to [intervals.icu](https://intervals.icu) and log in to **your coach account**
2. Click the **Settings** gear icon in the top right
3. Scroll down and click **Developer Settings**
4. Click **Create API Key** to generate a new key
5. **Copy and save this API key** — you'll need it in Step 3

---

## Step 2: Add the Script to Your Spreadsheet

1. Open your training plan spreadsheet in Google Sheets
2. Click **Extensions** in the menu bar
3. Click **Apps Script**
4. This opens the Apps Script editor in a new tab
5. **Delete** any existing code in the editor (select all and delete)
6. Open the `Code.gs` file from this folder
7. **Copy ALL the code** from `Code.gs`
8. **Paste** it into the Apps Script editor
9. Click **Save** or press `Ctrl+S` / `Cmd+S`
10. Give your project a name like "Coach Training Plan" when prompted

---

## Step 3: Initial Setup

1. Close the Apps Script editor tab
2. **Refresh** your spreadsheet page (F5 or Cmd+R)
3. Wait a few seconds — you should see a new **"Training Plan"** menu appear
4. Click **Training Plan > Settings**
5. Google will ask you to authorize the script:
   - Click **Continue**
   - Select your Google account
   - Click **Advanced** (at the bottom)
   - Click **Go to Coach Training Plan (unsafe)**
   - Click **Allow**
6. Enter your **coach API key** from Step 1

---

## Step 4: Create the Athletes Roster

1. Click **Training Plan > Create Athletes Tab**
2. A new "Athletes" tab will be created with these columns:

| Athlete Name | Athlete ID | Plan Tab | Last Synced |
|---|---|---|---|
| Jane Doe | i12345 | Jane - Marathon | |
| Bob Smith | i67890 | Bob - 10K | |

3. Fill in each row:
   - **Athlete Name**: their name (for your reference)
   - **Athlete ID**: their intervals.icu ID (e.g., `i12345` — found in their profile URL)
   - **Plan Tab**: the name of the sheet tab containing their training plan
4. Delete the example row

---

## Step 5: Athlete Onboarding

Each athlete needs to do these 3 things (no code, no API keys):

1. **Create a free [intervals.icu](https://intervals.icu) account**
2. **Connect their Garmin** in intervals.icu Settings > Connections
3. **Share their account with you**: Settings > Coach > add your coach email
4. **Tell you their Athlete ID** (visible in their profile URL, e.g., `i12345`)

You then add their ID to the Athletes tab — that's it.

---

## Step 6: Sync Training Plans

1. Make sure each athlete has a plan tab in the expected format (see below)
2. Click **Training Plan > Sync All Athletes** to push all plans at once
3. Or click **Training Plan > Sync Specific Athlete...** to pick one athlete

Re-syncing is safe — it **updates** existing workouts instead of creating duplicates.

---

## Menu Options

| Menu Item | Description |
|-----------|-------------|
| **Sync All Athletes** | Push training plans for every athlete in the roster |
| **Sync Specific Athlete...** | Pick one athlete to sync (with optional week filter) |
| **Preview Athlete Plan...** | Dry run — see what would be uploaded |
| **Create Athletes Tab** | One-time setup to create the roster tab |
| **Settings** | Enter your coach API key |
| **Help** | View help and format information |
| **Refresh Authorization** | Re-authorize if things stop working |
| **Setup Auto-Refresh** | Prevent Google from revoking script access |

---

## Plan Tab Format

Each athlete's training plan tab should follow this structure:

```
| A | B              | C (Mon)      | D (Tue)      | E (Wed)      | ... | I (Sun) |
|---|----------------|--------------|--------------|--------------|-----|---------|
|   | Week 1 22 Dec - 28 Dec |       |              |              |     |         |
|   | Activity       | Rest         | 45 min Easy  | 5x3:00 (60s) Z4 | ... |     |
|   | Purpose        |              | Base         | VO2max       | ... |         |
|   | Session Notes  |              |              | Interval session: ... | ... | |
```

### Key Requirements

- **Week headers**: must contain "Week" and a date range (e.g., "Week 1 22 Dec - 28 Dec")
- **Activity row**: label in column B must be "Activity"
- **Days**: columns C through I represent Monday through Sunday
- **Rest days**: enter "Rest" or leave blank

### Supported Workout Formats

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

### "Athletes tab not found" error
- Click Training Plan > Create Athletes Tab

### Plan tab not found for an athlete
- Check that the "Plan Tab" column in the Athletes tab exactly matches the sheet tab name (case-sensitive)

### Upload fails with HTTP 403
- Verify the athlete has shared their intervals.icu account with your coach account
- Check your API key is correct in Settings

### "Please configure your API key first"
- Click Training Plan > Settings and enter your coach API key

### Events not appearing correctly
- Use **Preview Athlete Plan...** to check what the script sees
- Make sure week headers include dates (e.g., "22 Dec - 28 Dec")
- Verify "Activity" is spelled correctly in column B

---

## Privacy & Security

- Your API key is stored in your Google account's user properties (not visible to athletes)
- The script only accesses the current spreadsheet
- No data is sent anywhere except to intervals.icu
- Athletes' API keys are never needed — the coach key handles everything
- You can revoke the script's access anytime in your Google Account settings

---

## Need Help?

1. Use **Training Plan > Preview Athlete Plan...** to debug
2. Check the Athletes tab for missing or incorrect data
3. Verify your spreadsheet format matches the examples above
