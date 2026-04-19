## Training Plan Uploader — Google Sheets to intervals.icu

Upload training plans from Google Sheets to [intervals.icu](https://intervals.icu) so workouts sync to athletes' Garmin devices.

**Two modes:**
- **Coach mode** — one coach manages plans for multiple athletes from a single spreadsheet, using one API key
- **Single-athlete mode** — an individual uploads their own plan (legacy, still supported)

**Two plan formats:**
- **Simple** — straightforward 4-week plans with activity descriptions
- **Extensive** — advanced plans with separate Activity, Purpose, and Session Notes rows

---

## Coach Mode (Recommended)

The coach writes individualized plans in separate sheet tabs and pushes workouts to each athlete's intervals.icu calendar. Athletes never touch API keys or scripts.

### How It Works

1. Coach has one intervals.icu account with one API key
2. Each athlete creates a free intervals.icu account, connects Garmin, and shares their account with the coach
3. Coach adds each athlete to a roster (Athletes tab in Google Sheets or `athletes` array in config)
4. Coach clicks "Sync All Athletes" — workouts appear on each athlete's intervals.icu calendar and sync to their Garmin

Re-syncing is safe: workouts are updated in place (no duplicates) via upsert.

### Athlete Onboarding (3 steps, no code)

1. Create a free [intervals.icu](https://intervals.icu) account
2. Connect Garmin: Settings > Connections
3. Share account with coach: Settings > Coach > add coach's email
4. Tell the coach your Athlete ID (visible in your profile URL, e.g., `i12345`)

---

## Quick Start: Choose Your Setup Method

### Option A: Google Apps Script (No Installation Required)

Run the uploader directly from Google Sheets — no terminal, no Python needed.

1. Open your training plan spreadsheet in Google Sheets
2. Go to **Extensions > Apps Script**
3. Copy the code from [`GoogleAppsScript/Code.gs`](GoogleAppsScript/Code.gs) and paste it
4. Save, refresh your spreadsheet, and use the new **"Training Plan"** menu
5. Click **Training Plan > Settings** to enter your coach API key
6. Click **Training Plan > Create Athletes Tab** to set up your roster
7. Click **Training Plan > Sync All Athletes** to push plans

[Full setup instructions](GoogleAppsScript/SETUP_INSTRUCTIONS.md)

---

### Option B: Python Script (For Technical Users)

#### Installation

```bash
pip install -r Configs/requirements.txt
```

#### Configuration

Copy and edit the config file:
```bash
cp Configs/config_example.json Configs/config.json
```

**Coach mode config:**
```json
{
  "intervals_icu": {
    "api_key": "your-coach-api-key"
  },
  "athletes": [
    {
      "name": "Jane Doe",
      "athlete_id": "i12345",
      "sheet_name": "Jane - Marathon"
    },
    {
      "name": "Bob Smith",
      "athlete_id": "i67890",
      "sheet_name": "Bob - 10K"
    }
  ],
  "google_sheets": {
    "sheet_id": "your-google-sheet-id"
  }
}
```

**Legacy single-athlete config** (still supported):
```json
{
  "intervals_icu": {
    "athlete_id": "i12345",
    "api_key": "your-api-key"
  },
  "google_sheets": {
    "sheet_id": "your-google-sheet-id",
    "sheet_name": "Training Plan"
  }
}
```

#### Google Sheets OAuth Setup

<details>

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable the Google Sheets API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Sheets API"
   - Click "Enable"
4. Configure OAuth Consent Screen:
   - Go to "APIs & Services" > "OAuth consent screen"
   - Choose "External" (unless you have a Google Workspace)
   - Fill in required fields (App name, User support email, etc.)
   - Click "Save and Continue"
   - On Scopes page: Click "Save and Continue" (default scopes are fine)
   - On Test users page: **Click "+ ADD USERS" and add your Google account email**
   - Click "Save and Continue"
   - Make sure "Publishing status" shows "Testing" (not "In production")
5. Create OAuth 2.0 Credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Application type: **"Desktop app"**
   - Name: "Training Plan Uploader" (or any name)
   - Click "Create"
   - Download the JSON file
   - Save it as `Configs/oauth_credentials.json` in the project directory

</details>

#### intervals.icu API Setup

<details>

1. Log in to [intervals.icu](https://intervals.icu)
2. Go to Settings > Developer Settings
3. Create an API key
4. Find your Athlete ID (format: `i12345`) in your profile URL

</details>

#### Running Commands — Coach Mode

Sync all athletes:
```bash
python3 Scripts/upload_extensive_plan.py --all
```

Sync a specific athlete:
```bash
python3 Scripts/upload_extensive_plan.py --athlete "Jane Doe"
```

Preview before uploading:
```bash
python3 Scripts/upload_extensive_plan.py --all --dry-run
```

Sync a specific week:
```bash
python3 Scripts/upload_extensive_plan.py --athlete "Jane Doe" --week 3
```

#### Running Commands — Legacy Single-Athlete Mode

Preview:
```bash
python3 Scripts/upload_simple_plan.py --week 1 --dry-run
```

Upload specific week:
```bash
python3 Scripts/upload_simple_plan.py --week 1
```

Upload all:
```bash
python3 Scripts/upload_simple_plan.py
```

Use a local CSV file:
```bash
python3 Scripts/upload_simple_plan.py --csv "Example_simple_plan.csv" --week 1 --dry-run
```

---

## Understanding Plan Structure

### Simple Plan Format

**Example simple plan:**
- [Google Sheet](https://docs.google.com/spreadsheets/d/1fXZHBjF_H9UQw7LEisU3upLH70cf0ax0IHB7kOH_qhA/edit?gid=1300751842#gid=1300751842)
- CSV: `Example_simple_plan.csv`

**Plan Structure Requirements:**

1. **Do not edit row or column structure** — the parser expects activities in columns C-I (Monday-Sunday)
2. **Dates must be in format** `"Jan 5 - Jan 11"` or `"(Jan 5 - Jan 11)"`
3. **Supported workout type must be stated in activity** — Easy, Intervals, Hill Intervals, Tempo, Threshold, Sprints, Long Run, Recovery
4. **Supported signs**: `&` or `+` for additional blocks, `x` for repetitions (e.g., `5x3min`)

**Supported Workout Types:**

| Format | Example |
|--------|---------|
| Recovery run | `Recovery: 30min Zone 1` |
| Easy run | `Easy: 60min Zone 2` |
| Easy with strides | `Easy: 60min Zone 2 & Strides 5x10sec + 50sec rest` |
| Intervals | `Intervals: 5x3min in Zone 3 + 60 sec rest` |
| Multiple interval blocks | `Intervals: 5x3min Z3 + 60sec rest\n5x3min Z4 + 60sec rest` |
| Hill intervals | `Hill Intervals: 20x1min in Zone 4 + 2min rest` |
| Tempo | `Tempo: 20min Zone 3` |
| Threshold | `Threshold: 15min Zone 4` |
| Sprints | `Sprints: 10x30sec + 60sec rest` |
| Long run | `Long Run: 60min Zone 2` |
| Long run with segments | `Long run: 20min zone 2 +\n10min zone 3 +\n20min zone 2` |
| Distance-based | `Easy: 10km Zone 2` |

### Extensive Plan Format (Advanced)

Separate Activity, Purpose, and Session Notes rows for detailed multi-workout plans.

**Sheet Structure:**
```
Row: Week header and date range (e.g., "Week 1\n22 Dec - 28 Dec")
Row: Activity    | Recovery Run & Strength | Interval Session | ... | Sunday Run
Row: Purpose     | Recovery                | Mechanics        | ... | Endurance
Row: Session Notes | ...                   | ...              | ... | ...
```

**Additional features not in simple plan:**
- Long runs with intervals — `80 mins inc. 8x5 mins Z3`
- Auto-progression runs — `15km progression run` (auto-divides into 3 segments)
- Race events — `HM Race` (sets category to "RACE")
- Combined workouts — `Recovery 30 mins and Leg Strength` (creates Run + Strength events)
- Zone progressions — `first 5 reps in Zone 3, final 5 reps in Zone 4`
- Multiple interval blocks in session notes — `5x3 min + 8x1:15 min`
- Keyword zone mapping — words like "easy", "tempo", "threshold" auto-map to zones

---

## Troubleshooting

### "Config file not found"
Copy `Configs/config_example.json` to `Configs/config.json` and fill in your credentials.

### "No 'athletes' array in config"
You're using `--athlete` or `--all` but your config uses the old single-athlete format. See the coach mode config example above.

### "OAuth credentials file not found"
Download `oauth_credentials.json` from Google Cloud Console > Credentials > OAuth client ID.

### "Access blocked: Training plan has not completed the Google verification process"
Go to "APIs & Services" > "OAuth consent screen", add yourself as a test user, ensure the app is in "Testing" mode.

### "Failed to upload events" / HTTP 403
- Check that your API key is correct
- For coach mode: verify the athlete has shared their intervals.icu account with your coach account
- Ensure your API key has write permissions

### "No workouts found"
- Check that your sheet structure matches the expected format exactly
- Make sure week headers include date ranges (e.g., "Jan 5 - Jan 11")
- Verify activities are in columns C-I (Monday-Sunday)
- Ensure the "Plan Tab" name in the Athletes roster exactly matches the sheet tab name

## License
