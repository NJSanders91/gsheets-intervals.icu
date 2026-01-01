#!/usr/bin/env python3
"""Simplified training plan uploader for Google Sheets."""

import json
import re
import csv
import os
from datetime import datetime, timedelta
from utils import load_config, get_sheets_service, fetch_sheet, upload_events, parse_duration, get_zone, get_recovery, format_strides, parse_week_start


def parse_simple_activity(activity_text):
    """Parse "Type: Description" format."""
    # Preserve newlines in description for multi-block parsing
    activity_text = activity_text.replace('\r', ' ').strip()
    if ":" in activity_text:
        purpose, activity = activity_text.split(":", 1)
        return purpose.strip(), activity.strip()
    return "", activity_text


def format_simple_workout(activity_desc, purpose=""):
    """Format activity description into workout steps."""
    steps = ["- Warmup"]
    desc_lower = activity_desc.lower()
    purpose_lower = purpose.lower()
    
    # Easy run with strides (using shared utils function)
    if "easy" in desc_lower or "easy" in purpose_lower:
        match = re.search(r"(\d+)\s*min", activity_desc, re.IGNORECASE)
        if match:
            steps.append(f"- {match.group(1)}m Z2 HR")
            format_strides(activity_desc, steps)
            steps.append("- Cooldown")
            return "\n".join(steps)
    
    # Handle multiple blocks separated by newlines or "+" (for intervals or long runs)
    # Split by newlines first
    if "\n" in activity_desc:
        blocks = [b.strip() for b in activity_desc.split("\n") if b.strip()]
    elif "+" in activity_desc and "x" not in activity_desc:
        # Split by "+" only for long runs (duration-based, no intervals)
        # Don't split if it contains "x" (intervals) as "+" is part of recovery spec
        blocks = [b.strip() for b in activity_desc.split("+") if b.strip()]
    else:
        blocks = [activity_desc]
    
    # Process each block
    for block in blocks:
        block_lower = block.lower()
        
        # Check for intervals pattern (Xx format) - simplified regex (no minute/minutes)
        interval_match = re.search(r"(\d+)x([\d:]+)\s*(?:m|min|mins?)?", block_lower)
        if interval_match:
            reps = interval_match.group(1)
            duration = parse_duration(interval_match.group(2))
            zone = get_zone(block, purpose, "Z4")
            
            steps.append(f"\nIntervals {reps}x")
            steps.append(f"- {duration} {zone} HR")
            
            # Find recovery
            recovery_str = get_recovery(block)
            if recovery_str:
                steps.append(f"- {recovery_str} Z1 HR Rest")
            continue
        
        # Check for duration + zone (steady-state runs) - handle "50min" (no space)
        duration_match = re.search(r"(\d+)\s*min", block_lower, re.IGNORECASE)
        if duration_match:
            steps.append(f"- {duration_match.group(1)}m {get_zone(block, purpose, 'Z2')} HR")
            continue
        
        # Check for distance-based (km)
        km_match = re.search(r"(\d+)\s*km", block_lower)
        if km_match:
            steps.append(f"- {km_match.group(1)}km {get_zone(block, purpose, 'Z2')} HR")
    
    steps.append("- Cooldown")
    return "\n".join(steps) if len(steps) > 2 else None


def parse_simple_training_plan(rows):
    """Parse simplified training plan format."""
    
    events = []
    week_start = None
    week_number = 0
    
    for i, row in enumerate(rows):
        if len(row) < 2:
            continue
        
        label = row[1].strip().lower() if len(row) > 1 else ""
        
        # Week header - must start with "week" followed by a number
        if re.match(r"week\s*\d", label):
            week_start = parse_week_start(row[1])
            week_number += 1
            continue
        
        # Activities row directly after week header
        if week_start and len(row) >= 9:
            activities = row[2:9]
            
            for day_idx, activity_text in enumerate(activities):
                if not activity_text or activity_text.strip().lower() in ["rest", "rest day"]:
                    continue
                
                purpose, activity_desc = parse_simple_activity(activity_text)
                workout_steps = format_simple_workout(activity_desc, purpose)
                
                if workout_steps:
                    # Name is the workout type (purpose), description is the workout summary
                    workout_name = purpose if purpose else activity_desc.split("\n")[0].split(":")[0].strip()
                    workout_summary = activity_desc.strip()
                    
                    events.append({
                        "start_date_local": (week_start + timedelta(days=day_idx)).strftime("%Y-%m-%dT00:00:00"),
                        "category": "WORKOUT",
                        "type": "Run",
                        "name": workout_name,
                        "description": f"{workout_summary}\n{workout_steps}",
                        "week_number": week_number,
                    })
    
    return events


def main():
    import argparse
    parser = argparse.ArgumentParser(
        description="Upload simplified training plan to intervals.icu"
    )
    parser.add_argument("--config", default=None, help="Path to config.json (defaults to Configs/config.json)")
    parser.add_argument("--csv", help="Use local CSV instead of Google Sheets")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--week", type=int, help="Upload only specific week number")
    args = parser.parse_args()
    
    config = load_config(args.config)
    
    # Load data
    if args.csv:
        # Resolve CSV path relative to script location or root
        if not os.path.isabs(args.csv) and not os.path.exists(args.csv):
            script_dir = os.path.dirname(os.path.abspath(__file__))
            csv_path = os.path.join(script_dir, "..", args.csv)
            if os.path.exists(csv_path):
                args.csv = csv_path
        with open(args.csv, encoding="utf-8") as f:
            rows = list(csv.reader(f))
    else:
        service = get_sheets_service()
        sheet_name = config["google_sheets"].get("sheet_name")
        rows = fetch_sheet(service, config["google_sheets"]["sheet_id"], sheet_name=sheet_name)
    
    # Parse
    events = parse_simple_training_plan(rows)
    
    # Filter by week if specified
    if args.week:
        events = [e for e in events if e.get("week_number") == args.week]
    
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

