Training Plan Upload Script

Upload your training plan from Google Sheets to [intervals.icu](https://intervals.icu).

Setup

1. Install Dependencies

```bash
pip install -r requirements.txt
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
   - Save it as `oauth_credentials.json` in this directory

3. intervals.icu API Setup

1. Log in to [intervals.icu](https://intervals.icu)
2. Go to Settings → Developer
3. Create an API key (or use existing)
4. Find your Athlete ID in Settings → Account (format: `i12345`)

4. Configure the Script

 1. Copy the example config:
   ```bash
   cp config.example.json config.json
   ```

 2. Edit `config.json` with your credentials:
   ```json
   {
     "intervals_icu": {
       "athlete_id": "ExampleID:i12345",
       "api_key": "your-api-key-here"
     },
     "google_sheets": {
       "sheet_id": "ExampleID:1UahP8l5RvetP3a-gHagBJDetZHJy6rak",
       "sheet_name": "Example_sheetID:Training Plan",
       "credentials_file": "oauth_credentials.json"
     }
   }
   ```
   - `athlete_id`: Your intervals.icu athlete ID
   - `api_key`: Your intervals.icu API key
   - `sheet_id`: The ID from your Google Sheet URL (the long string between `/d/` and `/edit`)
   - `sheet_name`: Optional - name of the specific sheet tab to use (defaults to first sheet)
   - `credentials_file`: Path to your OAuth credentials file (`oauth_credentials.json`)


The script is ready to use. It supports:

- Uploading by week (--week)
- Preview mode (--dry-run)
- CSV file option (--csv)
- OAuth2 authentication

Uploading to Intervals

Testing the upload

```bash
python3 upload_training_plan.py --week 3 --dry-run
```

Upload to intervals.icu

```bash
python3 upload_training_plan.py
```
Use a local CSV file

If you prefer to export your sheet as CSV or API is not working you can add a csv file manually to upload

```bash
python3 upload_training_plan.py --csv "path/to/your/file.csv" --week 3 --dry-run
```

**Note:** On first run, a browser window will open for OAuth authentication. After that, your credentials are saved and you won't need to authenticate again.

## Sheet Structure

The script expects your Google Sheet to have this structure:

```
Row: Week header and date range (e.g., "Week 1\n22 Dec - 28 Dec")
Row: Activity    | Monday workout | Tuesday workout | ... | Sunday workout
Row: Purpose     | Recovery       | Mechanics       | ... | Specific Endurance
Row: Session Notes | ...          | ...             | ... | ...
```

### Example Workout Formats

| Format | Example |
|--------|---------|
| Recovery | `Recovery 30 mins and Leg Strength` |
| Easy + Strides | `Easy 50 mins + 4x10 secs strides` |
| Intervals | `5x3:00 (60s) + 8x1:15 (30s) Z4` |
| Zone Progression | `10x3:00 (60s) Z3-Z4` |
| Distance Intervals | `10x1km (60s) Z3-Z4` |
| Hill Repeats | `10x3:00 hills (steady jog back) Z3` |
| Long Run | `80 mins inc. 8x5 mins Z3` |
| Progression Run | `15km progression run` |
| Marathon Effort | `3x5k at Marathon Effort (2:00)` |
| Race | `HM Race` |

## Troubleshooting

### "Config file not found"
Make sure you've copied `config.example.json` to `config.json` and filled in your credentials.

### "OAuth credentials file not found"
Make sure `oauth_credentials.json` exists in this directory. Download it from Google Cloud Console → Credentials → OAuth client ID.

### "Access blocked: Training plan has not completed the Google verification process"
- Go to "APIs & Services" → "OAuth consent screen"
- Make sure you're added as a test user
- Make sure the app is in "Testing" mode, not "In production"

### "Failed to upload events"
- Check that your API key is correct
- Verify your athlete ID is correct
- Ensure your API key has write permissions

### "No workouts found"
- Check that your sheet structure matches the expected format
- Make sure the week headers include date ranges (e.g., "22 Dec - 28 Dec")
- Verify the "Activity" row label is spelled correctly

## License

