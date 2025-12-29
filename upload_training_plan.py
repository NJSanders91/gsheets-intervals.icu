#!/usr/bin/env python3
"""
Training Plan Upload Script
Uploads training plan from Google Sheets to intervals.icu
"""

import json
import re
import csv
import base64
import requests
from datetime import datetime, timedelta
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build


def load_config(path="config.json"):
    with open(path) as f:
        return json.load(f)


def get_sheets_service(credentials_file):
    scopes = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    creds = service_account.Credentials.from_service_account_file(credentials_file, scopes=scopes)
    return build("sheets", "v4", credentials=creds)


def fetch_sheet(service, sheet_id):
    return service.spreadsheets().values().get(spreadsheetId=sheet_id, range="Sheet1").execute().get("values", [])


def format_workout_steps(activity):
    """Convert activity text to intervals.icu workout step format."""
    steps = []
    activity_lower = activity.lower()
    
    # Recovery run: "Recovery 30 mins"
    if "recovery" in activity_lower:
        match = re.search(r"(\d+)\s*mins?", activity)
        if match:
            steps.append(f"- {match.group(1)}m Z1 HR")
        return "\n".join(steps)
    
    # Easy run: "Easy 50 mins + 4x10 secs strides"
    if "easy" in activity_lower:
        match = re.search(r"(\d+)\s*mins?", activity)
        if match:
            steps.append(f"- {match.group(1)}m Z2 HR")
        # Add strides if present
        strides = re.search(r"(\d+)x(\d+)\s*secs?\s*strides", activity, re.IGNORECASE)
        if strides:
            steps.append(f"\nStrides {strides.group(1)}x")
            steps.append(f"- {strides.group(2)}s Z5 HR")
            steps.append("- 50s Z1 HR Recovery")
        return "\n".join(steps)
    
    # Long run with intervals: "80 mins inc. 8x5 mins Z3 HR"
    if "mins inc." in activity_lower:
        total = re.search(r"^(\d+)\s*mins?", activity)
        intervals = re.search(r"(\d+)x(\d+)\s*mins?\s*Z(\d)", activity, re.IGNORECASE)
        if total and intervals:
            reps, dur, zone = intervals.groups()
            steps.append("- 10m Z2 HR Warmup")
            steps.append(f"\nMain set {reps}x")
            steps.append(f"- {dur}m Z{zone} HR")
            steps.append("- 2m Z2 HR Recovery")
            steps.append("\n- 10m Z2 HR Cooldown")
        return "\n".join(steps)
    
    # Interval workout: "5x3:00 (60s) + 8x1:15 (30s) Z4 HR" or "10x3:00 (60s) Z3 HR-Z4"
    interval_pattern = r"(\d+)x([\d:]+)\s*\((\d+)s?\)"
    matches = re.findall(interval_pattern, activity, re.IGNORECASE)
    
    if matches:
        # Find zone
        zone_match = re.search(r"Z(\d)", activity, re.IGNORECASE)
        zone = zone_match.group(1) if zone_match else "4"
        
        steps.append("- 10m Z2 HR Warmup")
        
        for reps, dur, rest in matches:
            # Convert duration
            if ":" in dur:
                parts = dur.split(":")
                mins = int(parts[0])
                secs = int(parts[1]) if len(parts) > 1 else 0
                dur_str = f"{mins}m{secs}s" if secs else f"{mins}m"
            else:
                dur_str = f"{dur}m"
            
            rest_secs = int(rest)
            rest_str = f"{rest_secs // 60}m" if rest_secs >= 60 else f"{rest_secs}s"
            
            steps.append(f"\nIntervals {reps}x")
            steps.append(f"- {dur_str} Z{zone} HR")
            steps.append(f"- {rest_str} Z1 HR Rest")
        
        steps.append("\n- 10m Z2 HR Cooldown")
        return "\n".join(steps)
    
    # Progression run: "15km progression run"
    if "progression" in activity_lower:
        match = re.search(r"(\d+)\s*km", activity)
        if match:
            km = int(match.group(1))
            segment = km // 3
            steps.append("- 10m Z1 HR Warmup")
            steps.append(f"- {segment}km Z1 HR")
            steps.append(f"- {segment}km Z2 HR")
            steps.append(f"- {segment}km Z3 HR")
            steps.append("- 5m Z1 HR Cooldown")
        return "\n".join(steps)
    
    # Hill workout: "10x3:00 hills Z3 HR"
    if "hills" in activity_lower:
        match = re.search(r"(\d+)x([\d:]+)", activity)
        zone_match = re.search(r"Z(\d)", activity, re.IGNORECASE)
        zone = zone_match.group(1) if zone_match else "4"
        if match:
            reps, dur = match.groups()
            if ":" in dur:
                parts = dur.split(":")
                dur_str = f"{parts[0]}m"
            else:
                dur_str = f"{dur}m"
            steps.append("- 10m Z2 HR Warmup")
            steps.append(f"\nHills {reps}x")
            steps.append(f"- {dur_str} Z{zone} HR Uphill")
            steps.append(f"- {dur_str} Z1 HR Jog back")
            steps.append("\n- 10m Z2 HR Cooldown")
        return "\n".join(steps)
    
    return ""


def parse_week_start(text):
    """Parse 'Week 1\\n22 Dec - 28 Dec' to get Monday's date."""
    match = re.search(r"(\d{1,2})\s+(\w+)\s*-", text)
    if not match:
        return None
    
    day, month = int(match.group(1)), match.group(2).lower()[:3]
    months = {"jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
              "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12}
    
    year = datetime.now().year
    m = months.get(month, 1)
    if m < datetime.now().month and m <= 3:
        year += 1
    
    try:
        return datetime(year, m, day)
    except:
        return None


def parse_training_plan(rows):
    """Parse sheet rows into events."""
    events = []
    week_start = None
    session_notes = ""
    
    for i, row in enumerate(rows):
        if len(row) < 2:
            continue
        
        label = row[1].strip().lower() if len(row) > 1 else ""
        
        # Week header
        if "week" in label and re.search(r"\d+\s+\w+\s*-", row[1]):
            week_start = parse_week_start(row[1])
            continue
        
        # Session notes (store for current week)
        if label == "session notes":
            session_notes = row[2] if len(row) > 2 else ""
            continue
        
        # Activity row
        if label == "activity" and week_start:
            activities = row[2:9]
            
            # Get purposes from next row
            purposes = []
            if i + 1 < len(rows) and len(rows[i + 1]) > 1 and rows[i + 1][1].strip().lower() == "purpose":
                purposes = rows[i + 1][2:9]
            
            days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            
            for day_idx, activity in enumerate(activities):
                if not activity or activity.strip().lower() == "rest":
                    continue
                
                date = week_start + timedelta(days=day_idx)
                purpose = purposes[day_idx] if day_idx < len(purposes) else ""
                
                # Check for combined workout (run + strength)
                has_strength = "strength" in activity.lower()
                
                # Create run event
                run_name = re.sub(r"\s+and\s+.*strength.*", "", activity, flags=re.IGNORECASE).strip()
                
                # Build description with workout steps
                desc_parts = []
                if purpose:
                    desc_parts.append(f"Purpose: {purpose}")
                
                # Add formatted workout steps
                workout_steps = format_workout_steps(run_name)
                if workout_steps:
                    desc_parts.append("")
                    desc_parts.append(workout_steps)
                
                desc = "\n".join(desc_parts)
                
                events.append({
                    "start_date_local": date.strftime("%Y-%m-%dT00:00:00"),
                    "category": "RACE" if "race" in activity.lower() else "WORKOUT",
                    "type": "Run",
                    "name": run_name,
                    "description": desc.strip(),
                })
                
                # Create strength event if needed
                if has_strength:
                    events.append({
                        "start_date_local": date.strftime("%Y-%m-%dT00:00:00"),
                        "category": "WORKOUT",
                        "type": "WeightTraining",
                        "name": "Leg Strength",
                        "description": f"Purpose: {purpose}" if purpose else "",
                    })
    
    return events


def upload_events(events, athlete_id, api_key):
    """Upload events to intervals.icu."""
    auth = base64.b64encode(f"API_KEY:{api_key}".encode()).decode()
    url = f"https://intervals.icu/api/v1/athlete/{athlete_id}/events/bulk"
    headers = {"Authorization": f"Basic {auth}", "Content-Type": "application/json"}
    
    response = requests.post(url, headers=headers, json=events)
    return response.status_code == 200, response.text


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Upload training plan to intervals.icu")
    parser.add_argument("--config", default="config.json")
    parser.add_argument("--csv", help="Use local CSV instead of Google Sheets")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--week", type=int, help="Upload only specific week number")
    args = parser.parse_args()
    
    config = load_config(args.config)
    
    # Load data
    if args.csv:
        with open(args.csv, encoding="utf-8") as f:
            rows = list(csv.reader(f))
    else:
        service = get_sheets_service(config["google_sheets"]["credentials_file"])
        rows = fetch_sheet(service, config["google_sheets"]["sheet_id"])
    
    # Parse
    events = parse_training_plan(rows)
    
    # Filter by week if specified
    if args.week:
        # Week 1 starts Dec 22, each week is 7 days
        base = datetime(2025, 12, 22) + timedelta(weeks=args.week - 1)
        end = base + timedelta(days=6)
        events = [e for e in events if base.strftime("%Y-%m-%d") <= e["start_date_local"][:10] <= end.strftime("%Y-%m-%d")]
    
    # Preview
    print(f"Found {len(events)} events:\n")
    for e in events:
        print(f"  {e['start_date_local'][:10]} | {e['name'][:35]:35} | {e['type']}")
    
    if args.dry_run:
        print("\n[DRY RUN] No upload.")
        return
    
    # Upload
    athlete_id = config["intervals_icu"]["athlete_id"]
    api_key = config["intervals_icu"]["api_key"]
    
    print(f"\nUploading to intervals.icu...")
    success, response = upload_events(events, athlete_id, api_key)
    
    if success:
        print("Done!")
    else:
        print(f"Failed: {response}")


if __name__ == "__main__":
    main()
