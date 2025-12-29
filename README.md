# Training Plan Upload Script

Upload your training plan from Google Sheets to [intervals.icu](https://intervals.icu).

## Features

- Reads training plan directly from Google Sheets
- Parses various workout formats:
  - Recovery runs with strength training
  - Easy runs with strides
  - Interval workouts (time and distance-based)
  - Hill repeats
  - Long runs with intervals
  - Progression runs
  - Marathon effort workouts
  - Races
- Uses RPE zones as primary intensity metric
- Splits combined workouts (e.g., "Recovery + Strength") into separate events
- Supports dry-run mode to preview before uploading

## Zone System

| Zone | Intensity | RPE | Description |
|------|-----------|-----|-------------|
| Z1 | Recovery | 1 | Very easy, recovery pace |
| Z2 | Easy | 3 | Conversational pace |
| Z3 | Threshold | 6 | Marathon/tempo effort |
| Z4 | VO2max | 8 | 10k effort |
| Z5 | VO2max+ | 9 | 5k-mile effort |
| Z6 | Sprint | 10 | All-out sprint |

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Google Sheets API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable the Google Sheets API:
   - Go to "APIs & Services" → "Library"
   - Search for "Google Sheets API"
   - Click "Enable"
4. Create a Service Account:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "Service Account"
   - Name it (e.g., "training-plan-uploader")
   - Click "Done"
5. Create a key for the service account:
   - Click on the service account you just created
   - Go to "Keys" tab
   - Click "Add Key" → "Create new key"
   - Select "JSON" and click "Create"
   - Save the downloaded file as `credentials.json` in this directory
6. Share your Google Sheet:
   - Open your training plan Google Sheet
   - Click "Share"
   - Add the service account email (found in `credentials.json` as `client_email`)
   - Give it "Viewer" access

### 3. intervals.icu API Setup

1. Log in to [intervals.icu](https://intervals.icu)
2. Go to Settings → Developer
3. Create an API key (or use existing)
4. Find your Athlete ID in Settings → Account (format: `i12345`)

### 4. Configure the Script

1. Copy the example config:
   ```bash
   cp config.example.json config.json
   ```

2. Edit `config.json` with your credentials:
   ```json
   {
     "intervals_icu": {
       "athlete_id": "i12345",
       "api_key": "your-api-key-here"
     },
     "google_sheets": {
       "sheet_id": "1UahP8l5RvetP3a-gHagBJDetZHJy6rak",
       "credentials_file": "credentials.json"
     }
   }
   ```

   - `athlete_id`: Your intervals.icu athlete ID
   - `api_key`: Your intervals.icu API key
   - `sheet_id`: The ID from your Google Sheet URL (the long string between `/d/` and `/edit`)
   - `credentials_file`: Path to your Google service account credentials

## Usage

### Preview workouts (dry run)

```bash
python upload_training_plan.py --dry-run
```

### Upload to intervals.icu

```bash
python upload_training_plan.py
```

### Use a local CSV file

If you prefer to export your sheet as CSV:

```bash
python upload_training_plan.py --csv "path/to/your/file.csv" --dry-run
```

## Sheet Structure

The script expects your Google Sheet to have this structure:

```
Row: Week header (e.g., "Week 1\n22 Dec - 28 Dec")
Row: Activity    | Monday workout | Tuesday workout | ... | Sunday workout
Row: Purpose     | Recovery       | Mechanics       | ... | Specific Endurance
Row: Your Notes  | ...            | ...             | ... | ...
Row: Lee' Notes  | ...            | ...             | ... | ...
Row: Session Notes | ...          | ...             | ... | ...
```

### Supported Workout Formats

| Format | Example |
|--------|---------|
| Recovery + Strength | `Recovery 30 mins and Leg Strength` |
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

### "Google credentials file not found"
Download the service account key from Google Cloud Console and save it as `credentials.json`.

### "Failed to upload events"
- Check that your API key is correct
- Verify your athlete ID is correct
- Ensure your API key has write permissions

### "No workouts found"
- Check that your sheet structure matches the expected format
- Make sure the week headers include date ranges (e.g., "22 Dec - 28 Dec")
- Verify the "Activity" row label is spelled correctly

## License

MIT

