Training Plan Upload

Upload your training plan from Google Sheets to [intervals.icu](https://intervals.icu) so it can be synced adn uploaded to your Garmin device. 

**Pre Requisites Setup**

1. Install Dependencies

```bash
pip install -r Configs/requirements.txt
```

2. Google Sheets OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable the Google Sheets API:
   - Go to "APIs & Services" → "Library"
   - Search for "Google Sheets API"
   - Click "Enable"
4. Configure OAuth Consent Screen:
   - Go to "APIs & Services" → "OAuth consent screen"
   - Choose "External" (unless you have a Google Workspace)
   - Fill in required fields (App name, User support email, etc.)
   - Click "Save and Continue"
   - On Scopes page: Click "Save and Continue" (default scopes are fine)
   - On Test users page: **Click "+ ADD USERS" and add your Google account email**
   - Click "Save and Continue"
   - Make sure "Publishing status" shows "Testing" (not "In production")
5. Create OAuth 2.0 Credentials:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: **"Desktop app"**
   - Name: "Training Plan Uploader" (or any name)
   - Click "Create"
   - Download the JSON file
   - Save it as `Configs/oauth_credentials.json` in the project directory

3. intervals.icu API Setup

1. Log in to [intervals.icu](https://intervals.icu)
2. Go to Settings → Developer
3. Create an API key (or use existing)
4. Find your Athlete ID in Settings → Account (format: `i12345`)

4. Configure the Script

1. Copy the example config:
   ```bash
   cp Configs/config_example.json Configs/config.json
   ```

2. Edit `Configs/config.json` with your credentials:
   ```json
   {
     "intervals_icu": {
       "athlete_id": "ExampleIDi12345",
       "api_key": "your-api-key-here"
     },
     "google_sheets": {
       "sheet_id": "ExampleID:1UahP8l5RvetP3a-gHagBJDetZHJy6rak",
       "sheet_name": "Example_sheetID:Training Plan",
       "credentials_file": "Configs/oauth_credentials.json"
     }
   }
   ```
   - `athlete_id`: Your intervals.icu athlete ID
   - `api_key`: Your intervals.icu API key
   - `sheet_id`: The ID from your Google Sheet URL (the long string between `/d/` and `/edit`)
   - `sheet_name`: Optional - name of the specific sheet tab to use (defaults to first sheet)
   - `credentials_file`: Path to your OAuth credentials file (relative to project root: `Configs/oauth_credentials.json`)

**Running the tool - Simple plan**

GSheets
https://docs.google.com/spreadsheets/d/1cMErpnjcfHi9aQ3Vk1bJ4qO_3Y3kbLWIY9-pppNEjwA/edit?gid=1300751842#gid=1300751842
.csv file Example_simple_plan.csv

**Note:** 
On first run, a browser window will open for OAuth authentication. After that, your credentials are saved and you won't need to authenticate again.

Preview
```bash
python3 Scripts/upload_simple_plan.py --week 1 --dry-run
```

Upload specific week:
```bash
python3 Scripts/upload_simple_plan.py --week 1
```

Upload all
```bash
python3 Scripts/upload_simple_plan.py
```

Use a local CSV file instead of Google Sheets
```bash
python3 Scripts/upload_simple_plan.py --csv "Example_simple_plan.csv" --week 1 --dry-run
```

**Training Plans**

NOTE: I am not a coach and the example training plan is a mix of sessions I enjoy and that work for me. This is not a verified plan and should be altered to each individuals needs. 

Example plan: 
Gsheets:(https://docs.google.com/spreadsheets/d/1fXZHBjF_H9UQw7LEisU3upLH70cf0ax0IHB7kOH_qhA/edit?gid=1300751842#gid=1300751842)

CSV file: Example_simple_plan.csv for local upload direct from this repo

**Simple Plan Format (Recommended)**

The simple plan format uses a streamlined structure with "Session Type: Description" format.

**Plan Structure Requirements**

The plan structure **must** be followed exactly for the parser to work correctly:

1. **Do not edit Row or Column structure** - The parser expects activities in specific columns (C-I for Monday-Sunday)
2. **Dates must be in format** `"Jan 5 - Jan 11"` or `"(Jan 5 - Jan 11)"` - Required for the parser to extract week start dates
3. **Supported workout type must be stated in activity** - Use workout types like: Easy, Intervals, Hill Intervals, Tempo, Threshold, Sprints, Long Run, Recovery
4. **Supported signs**: Use `&` or `+` for additional blocks, `x` for multiple intervals (e.g., `5x3min` means 5 repetitions of 3 minutes)

**Supported Workout Type examples:**

- Recovery runs - `Recovery: 30min Zone 1`
- Easy runs - `Easy: 60min Zone 2`
- Easy runs with strides - `Easy: 60min Zone 2 & Strides 5x10sec + 50sec rest`
- Interval sessions - `Intervals: 5x3min in Zone 3 + 60 sec rest`
- Multiple interval blocks - `Intervals: 5x3min in Zone 3 + 60sec rest\n5x3min in Zone 4 + 60sec rest`
- Hill intervals - `Hill Intervals: 20x1min in Zone 4 + 2min rest`
- Tempo runs - `Tempo: 20min Zone 3` (or `Tempo: 20min` - defaults to Z3)
- Threshold runs - `Threshold: 15min Zone 4` (or `Threshold: 15min` - defaults to Z4)
- Sprints - `Sprints: 10x30sec + 60sec rest` (defaults to Z5)
- Long runs - `Long Run: 60min Zone 2`
- Long runs with segments - `Long run: 20min zone 2 +\n10min zone 3 +\n20min zone 2`
- Distance-based runs - `Easy: 10km Zone 2`


**Extensive Plan Format (Advanced)**

This allows more flexibility and different workout plan formats. You will still need separate Activity, Purpose, and Session Notes rows. 


The extensive format is designed for more miles/detailed workouts or multiple workouts per day. Activity is the type (run/weights), purpose is the goal of the workout session notes has the breakdown. 

#### When to Use Extensive Format

Use the extensive format if you need:
- **Separate Purpose tracking** - Track workout purpose separately from activity description
- **Complex session notes** - Detailed session notes with zone progressions, multiple interval blocks, etc.
- **Advanced workout parsing** - Support for complex formats like zone progressions, marathon effort intervals, etc.
- **Combined workouts** - Support for multiple workouts in one day. For example run + strength workouts in one cell

**Sheet Structure:**
```
Row: Week header and date range (e.g., "Week 1\n22 Dec - 28 Dec")
Row: Activity    | Recovery Run & Strength workout | Interval Session | ... | Sunday Run
Row: Purpose     | Recovery       | Mechanics       | ... | Specific Endurance
Row: Session Notes | ...          | ...             | ... | ...
```

**Extra Features in Extensive Format**

The extensive format provides these additional features **not available in the simple plan**:

**Unique Workout Formats:**
- Long runs with intervals - `80 mins inc. 8x5 mins Z3` or `Long 80 mins + 8x5 mins Z3` (long run + interval parsing)
- Auto-progression runs - `15km progression run` (automatically divides into 3 equal segments)
- Race events - `HM Race` (sets category to "RACE" instead of "WORKOUT")
- Combined workouts - `Recovery 30 mins and Leg Strength` (creates separate Run + Strength events)

**Detailed Session Notes Features:**
- Zone progressions -  "first X reps in Zone Y, final Z reps in Zone W" (e.g., "first 5 reps in Zone 3, final 5 reps in Zone 4")
- Multiple interval blocks - Handles "+" separated intervals in session notes (e.g., "5x3 min + 8x1:15 min")
- Keyword zone mapping - Converts words like "easy", "recovery", "tempo", "threshold" to zones in session notes

**Format Differences:**
- Allow for multiple session in one day using Activities row
- Separate Purpose row - Track workout purpose separately from activity description
- Session Notes row - Detailed breakdown of workouts in separate row
- Multiple rows per day - Activity, Purpose, and Session Notes rows for each day


**Troubleshooting**

### "Config file not found"
Make sure you've copied `Configs/config_example.json` to `Configs/config.json` and filled in your credentials.

### "OAuth credentials file not found"
Make sure `Configs/oauth_credentials.json` exists in the project directory. Download it from Google Cloud Console → Credentials → OAuth client ID.

### "Access blocked: Training plan has not completed the Google verification process"
- Go to "APIs & Services" → "OAuth consent screen"
- Make sure you're added as a test user
- Make sure the app is in "Testing" mode, not "In production"

### "Failed to upload events"
- Check that your API key is correct
- Verify your athlete ID is correct
- Ensure your API key has write permissions

### "No workouts found"
- Check that your sheet structure matches the expected format **exactly**
- Make sure the week headers include date ranges (e.g., "Jan 5 - Jan 11" or "(Jan 5 - Jan 11)")
- Verify activities row comes directly after week header row (no "Session" label needed for simple plan)
- Ensure dates are in the correct format: "Jan 5 - Jan 11" (month abbreviation, day number)
- Check that activities are in columns C-I (Monday-Sunday)

## License
