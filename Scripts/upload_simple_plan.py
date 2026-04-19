#!/usr/bin/env python3
"""
Simplified training plan uploader — supports coach mode for multiple athletes.
"""

import json
import re
import csv
import os
from datetime import datetime, timedelta
from utils import load_config, get_sheets_service, fetch_sheet, upload_events, parse_duration, get_zone, get_recovery, format_strides, parse_week_start, generate_external_id

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
                
                if workout_steps or purpose or activity_desc:
                    # Name is the workout type (purpose), description is the workout summary
                    workout_name = activity_desc.split("\n")[0].split(":")[0].strip()
                    workout_summary = activity_desc.strip()
                    details = f"\n{workout_steps}" if workout_steps else ""
                    description = f"Purpose: {purpose}\n{workout_summary}{details}" if purpose else f"{workout_summary}{details}"
                    
                    events.append({
                        "start_date_local": (week_start + timedelta(days=day_idx)).strftime("%Y-%m-%dT00:00:00"),
                        "category": "WORKOUT",
                        "type": "Run",
                        "name": workout_name,
                        "description": description,
                        "week_number": week_number,
                    })
    
    return events


def sync_athlete(config, athlete_name, athlete_id, sheet_name, week_filter, dry_run, service=None):
    """Sync a single athlete's simple plan. Returns (success, event_count, error)."""

    api_key = config["intervals_icu"]["api_key"]
    sheet_id = config["google_sheets"]["sheet_id"]

    if service is None:
        service = get_sheets_service()

    rows = fetch_sheet(service, sheet_id, sheet_name=sheet_name)
    events = parse_simple_training_plan(rows)

    if week_filter:
        events = [e for e in events if e.get("week_number") == week_filter]

    for event in events:
        event["external_id"] = generate_external_id(athlete_id, event["start_date_local"], event["name"])
        event.pop("week_number", None)

    print(f"\n{'─' * 60}")
    print(f"  {athlete_name} ({athlete_id}) — {len(events)} events from '{sheet_name}'")
    print(f"{'─' * 60}")
    for e in events:
        print(f"  {e['start_date_local'][:10]} | {e['name'][:35]:35} | {e['type']}")

    if not events:
        return False, 0, "No events found"

    if dry_run:
        return True, len(events), None

    success, response = upload_events(events, athlete_id, api_key, upsert=True)
    if success:
        return True, len(events), None
    return False, 0, response


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Upload simple training plans to intervals.icu (coach mode)")
    parser.add_argument("--config", default=None, help="Path to config.json")
    parser.add_argument("--csv", help="Use local CSV instead of Google Sheets (single-athlete only)")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--week", type=int, help="Upload only specific week number")
    parser.add_argument("--athlete", help="Sync a specific athlete by name (coach mode)")
    parser.add_argument("--all", action="store_true", dest="sync_all", help="Sync all athletes in roster (coach mode)")
    args = parser.parse_args()

    config = load_config(args.config)

    # Coach mode
    if args.athlete or args.sync_all:
        athletes = config.get("athletes", [])
        if not athletes:
            print("Error: No 'athletes' array in config. See config_example.json for coach mode format.")
            return

        if args.athlete:
            match = [a for a in athletes if a["name"].lower() == args.athlete.lower()]
            if not match:
                names = ", ".join(a["name"] for a in athletes)
                print(f"Error: Athlete '{args.athlete}' not found. Available: {names}")
                return
            targets = match
        else:
            targets = athletes

        service = get_sheets_service()
        results = []
        for athlete in targets:
            success, count, error = sync_athlete(
                config, athlete["name"], athlete["athlete_id"],
                athlete["sheet_name"], args.week, args.dry_run, service
            )
            results.append((athlete["name"], success, count, error))

        print(f"\n{'═' * 60}")
        print(f"  Summary: {sum(1 for _, s, _, _ in results if s)}/{len(results)} succeeded")
        for name, success, count, error in results:
            status = f"{count} events" if success else f"FAILED: {error}"
            print(f"  {'OK' if success else 'FAIL'}  {name}: {status}")
        if args.dry_run:
            print("\n  [DRY RUN] No uploads performed.")
        return

    # Legacy single-athlete mode
    if args.csv:
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

    events = parse_simple_training_plan(rows)

    if args.week:
        events = [e for e in events if e.get("week_number") == args.week]

    print(f"Found {len(events)} events:\n")
    for e in events:
        print(f"  {e['start_date_local'][:10]} | {e['name'][:35]:35} | {e['type']}")

    if args.dry_run:
        print("\n[DRY RUN] No upload.")
        return

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

