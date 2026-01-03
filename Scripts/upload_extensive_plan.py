 #!/usr/bin/env python3
"""
Script to upload training plan from Google Sheets to intervals.icu
"""

import json
import re
import csv
import os
from datetime import datetime, timedelta
from utils import load_config, get_sheets_service, fetch_sheet, upload_events, parse_duration, get_zone, get_recovery, format_strides, format_hills, parse_week_start


def format_workout_steps(activity):
    """Convert activity text to intervals.icu workout step format."""
    steps = ["- Warmup\n- 10m Z2 HR"]
    activity_lower = activity.lower()
    
    # Recovery run
    if "recovery" in activity_lower:
        steps = ["- Warmup"] 
        match = re.search(r"(\d+)\s*mins?", activity)
        if match:
            steps.append(f"- {match.group(1)}m Z1 HR")
            steps.append("- Cooldown")  
            return "\n".join(steps)
    
    # Easy run
    if "easy" in activity_lower:
        steps = ["- Warmup"]
        match = re.search(r"(\d+)\s*mins?", activity)
        if match:
            steps.append(f"- {match.group(1)}m Z2 HR")
            format_strides(activity, steps)
            steps.append("\n- Cooldown")
            return "\n".join(steps)
    
    # Long run
    if "long" in activity_lower or "inc." in activity_lower:
        steps = ["- Warmup"]
        match = re.search(r"(\d+)\s*mins?", activity)
        if match:
            steps.append(f"- {match.group(1)}m Z2 HR")
            # Check for intervals added with "+", "&", "and", "with", or "inc."
            intervals = (re.search(r"[\+\&]\s*(\d+)x(\d+)\s*mins?\s*Z(\d)", activity, re.IGNORECASE) or
                        re.search(r"(?:and|with)\s+(\d+)x(\d+)\s*mins?\s*Z(\d)", activity, re.IGNORECASE) or
                        (re.search(r"(\d+)x(\d+)\s*mins?\s*Z(\d)", activity, re.IGNORECASE) if "inc." in activity_lower else None))
            if intervals:
                reps, dur, zone = intervals.groups()
                steps.append(f"\nIntervals {reps}x")
                steps.append(f"- {dur}m Z{zone} HR")
                steps.append("- 2m Z2 HR Recovery")
            steps.append("\n- 10m Z2 HR")
            steps.append("- Cooldown")
            return "\n".join(steps)
    
    # Interval workout: "5x3:00 (60s) Z4"
    interval_pattern = r"(\d+)x([\d:]+)\s*\((\d+)s?\)"
    matches = re.findall(interval_pattern, activity, re.IGNORECASE)
    if matches:
        zone_match = re.search(r"Z(\d)", activity, re.IGNORECASE)
        zone = zone_match.group(1) if zone_match else "4"
        for reps, dur, rest in matches:
            dur_str = parse_duration(dur)
            rest_secs = int(rest)
            rest_str = f"{rest_secs // 60}m" if rest_secs >= 60 else f"{rest_secs}s"
            steps.append(f"\nIntervals {reps}x")
            steps.append(f"- {dur_str} Z{zone} HR")
            steps.append(f"- {rest_str} Z1 HR Rest")
        steps.append("\n- 10m Z2 HR")
        steps.append("- Cooldown")
        return "\n".join(steps)
    
    # Progression run
    if "progression" in activity_lower:
        steps = ["- Warmup"]
        match = re.search(r"(\d+)\s*km", activity)
        if match:
            segment = int(match.group(1)) // 3
            steps.extend([f"- {segment}km Z1 HR", f"- {segment}km Z2 HR", f"- {segment}km Z3 HR"])
            steps.append("\n- 10m Z2 HR")
            steps.append("- Cooldown")
            return "\n".join(steps)
    
    # Hill workout: "10x3:00 hills Z3 HR"
    if "hill" in activity_lower:
        steps = ["- Warmup", "- 10m Z2 HR"]
        if format_hills(activity, steps, ""):
            steps.append("\n- 10m Z2 HR")
            steps.append("- Cooldown")
            return "\n".join(steps)
    
    return ""


def parse_session_notes(session_note, is_interval=False):
    """Parse session notes and convert to structured workout steps format."""
    
    if not session_note:
        return None
    
    steps = []
    note_lower = session_note.lower()
    
    # Zone mappings
    zone_map = {
        "rest": "Z1",
        "recovery": "Z1",
        "jog": "Z1",
        "walk": "Z1",
        "easy": "Z2",
        "steady": "Z2",
        "moderate": "Z2",
        "tempo": "Z3",
        "threshold": "Z3",
        "marathon": "Z3",
        "hard": "Z4",
        "vo2max": "Z4",
        "fast": "Z4",
        "sprint": "Z5",
    }
    
    # Split by common separators (newlines or /)
    # First try newlines, then fall back to /
    if '\n' in session_note:
        parts = [p.strip() for p in session_note.split('\n') if p.strip()]
    else:
        parts = re.split(r'\s*/\s*', session_note)
    
    # Extract title if present (e.g., "Long Run:", "Interval Session:")
    title = None
    if ':' in parts[0]:
        title_parts = parts[0].split(':', 1)
        title = title_parts[0].strip()
        parts[0] = title_parts[1].strip() if len(title_parts) > 1 else ""
    
    # Check if warmup/cooldown are already in the session note
    has_warmup = any("warmup" in p.lower() or "warm up" in p.lower() for p in parts)
    has_cooldown = any("cooldown" in p.lower() or "cool down" in p.lower() for p in parts)
    
    # Check if this is an interval workout by looking for interval patterns
    if not is_interval:
        is_interval = any(re.search(r"(\d+)x([\d:]+)", p.lower()) for p in parts) or "interval" in note_lower
    
    if title:
        steps.append(f"{title}:")
        steps.append("")
    
    
    # Add Warmup - only intervals get "10m Z2 HR" detail
    if not has_warmup:
        if is_interval:
            steps.append("- Warmup\n- 10m Z2 HR")
        else:
            steps.append("- Warmup")
    
    i = 0
    while i < len(parts):
        part = parts[i].strip()
        if not part:
            i += 1
            continue
        
        part_lower = part.lower()
        
        # Check for warmup/cooldown
        if "warmup" in part_lower or "warm up" in part_lower:
            if is_interval:
                steps.append("- Warmup\n- 10m Z2 HR")
            else:
                steps.append("- Warmup")
            i += 1
            continue
        
        if "cooldown" in part_lower or "cool down" in part_lower:
            if is_interval:
                steps.append("\n- Cooldown 10m Z2 HR")
            else:
                steps.append("- Cooldown")
            i += 1
            continue
        
        # Check for multiple intervals separated by "+" in the same part
        if "+" in part:
            interval_parts = [p.strip() for p in part.split("+")]
            for interval_part in interval_parts:
                if not interval_part:
                    continue
                interval_part_lower = interval_part.lower()
                interval_match = re.search(r"(\d+)x([\d:]+)\s*(?:min|mins|minute|minutes)?", interval_part_lower)
                if interval_match:
                    reps, duration_raw = int(interval_match.group(1)), interval_match.group(2)
                    duration = parse_duration(duration_raw)
                    zone = get_zone(interval_part, "", "Z4")
                    recovery_str = get_recovery(interval_part)
                    
                    steps.append(f"\nIntervals {reps}x")
                    steps.append(f"- {duration} {zone} HR")
                    if recovery_str:
                        steps.append(f"- {recovery_str} Z1 HR Rest")
            i += 1
            continue
        
        # Check for interval pattern
        interval_match = re.search(r"(\d+)x([\d:]+)\s*(?:min|mins|minute|minutes)?", part_lower)
        if interval_match:
            reps, duration_raw = int(interval_match.group(1)), interval_match.group(2)
            duration = parse_duration(duration_raw)
            
            # Check for zone progression: "first X reps in Zone Y, final Z reps in Zone W"
            progression_match = re.search(r"first\s+(\d+)\s+reps?\s+in\s+zone\s*(\d).*?final\s+(\d+)\s+reps?\s+in\s+zone\s*(\d)", part_lower)
            next_part = parts[i + 1] if i + 1 < len(parts) else None
            recovery_str = get_recovery(part, check_next=True, next_part=next_part)
            
            if progression_match:
                first_reps, first_zone = int(progression_match.group(1)), f"Z{progression_match.group(2)}"
                final_reps, final_zone = int(progression_match.group(3)), f"Z{progression_match.group(4)}"
                
                for reps, zone in [(first_reps, first_zone), (final_reps, final_zone)]:
                    steps.append(f"\nIntervals {reps}x")
                    steps.append(f"- {duration} {zone} HR")
                    if recovery_str:
                        steps.append(f"- {recovery_str} Z1 HR Rest")
            else:
                zone = get_zone(part, "", "Z4")
                steps.append(f"\nIntervals {reps}x")
                steps.append(f"- {duration} {zone} HR")
                if recovery_str:
                    steps.append(f"- {recovery_str} Z1 HR Rest")
            
            # Skip recovery part if it was in next part
            if recovery_str and recovery_str not in part_lower and i + 1 < len(parts):
                i += 2
            else:
                i += 1
            continue
        
        # Check for simple duration with zone word: "20 min easy"
        duration_match = re.search(r"(\d+)\s*(?:min|mins|minute|minutes)", part_lower)
        if duration_match:
            duration = duration_match.group(1)
            # Find zone from keywords or zone number
            zone = get_zone(part, "", "Z2")
            # Override with zone_map keywords if found
            for keyword, z in zone_map.items():
                if keyword in part_lower:
                    zone = z
                    break
            steps.append(f"- {duration}m {zone} HR")
            i += 1
            continue
        
        # Check for distance with zone: "5km in Zone 1" or "5km Zone 2" or "5 km Z3"
        km_match = re.search(r"(\d+)\s*km", part_lower)
        if km_match:
            distance = km_match.group(1)
            zone = get_zone(part, "", "Z2")
            steps.append(f"- {distance}km {zone} HR")
            i += 1
            continue
        
        # Fallback: skip non-workout lines (titles, descriptions without numbers)
        # Only add if it contains numbers (likely a workout step)
        if part and not part.endswith(":") and re.search(r'\d', part):
            steps.append(f"- {part}")
        i += 1
    
    # Add Cooldown - only intervals get "10m Z2 HR" detail
    if not has_cooldown:
        if is_interval:
            steps.append("\n- Cooldown 10m Z2 HR")
        else:
            steps.append("- Cooldown")
    
    return "\n".join(steps) if steps else None


def match_session_notes_to_workout(session_note, activity, purpose=""):
    """Match session notes to a workout based on keywords and purpose."""
    
    if not session_note:
        return None
    
    activity_lower = activity.lower()
    session_note_lower = session_note.lower()
    purpose_lower = purpose.lower() if purpose else ""
    
    # Don't match session notes to recovery runs - recovery runs should use auto-generated format
    if "recovery" in activity_lower:
        return None
    
    # Match patterns
    # Hill session - matches hill workouts (check FIRST before interval)
    # Hills should use auto-generated format, not session notes
    if "hill" in activity_lower:
        # Don't use any session notes for hill workouts - use auto-generated format
        return None
    
    # Interval session - matches interval workouts (must have "x" and ":" pattern in activity)
    # OR matches if purpose is VO2max
    if "interval" in session_note_lower:
        # Match if activity is an interval workout OR purpose is VO2max
        if ("x" in activity_lower and ":" in activity) or "vo2max" in purpose_lower:
            return parse_session_notes(session_note, is_interval=True)
        # Don't match interval session notes to non-interval activities
        return None
    
    # Long run - matches long run workouts
    if "long run" in session_note_lower and ("long" in activity_lower or "inc." in activity_lower):
        return parse_session_notes(session_note, is_interval=False)
    
    # Progression run
    if "progression" in session_note_lower and "progression" in activity_lower:
        return parse_session_notes(session_note, is_interval=False)
    
    # If no specific match but note exists for this day, parse it anyway
    # But skip if it's a recovery run
    # Also skip if session note mentions a specific workout type that doesn't match the activity
    if session_note.strip() and "recovery" not in activity_lower:
        # Don't apply hill session notes to non-hill activities
        if "hill" in session_note_lower and "hill" not in activity_lower:
            return None
        # Don't apply long run notes to non-long run activities
        if "long run" in session_note_lower and "long" not in activity_lower and "inc." not in activity_lower:
            return None
        # Check if it's an interval workout
        is_interval_workout = ("x" in activity_lower and ":" in activity) or "vo2max" in purpose_lower
        return parse_session_notes(session_note, is_interval=is_interval_workout)
    
    return None


def parse_training_plan(rows):
    """Parse sheet rows into events."""
    
    events = []
    week_start = None
    week_number = None
    session_notes = []
    
    for i, row in enumerate(rows):
        if len(row) < 2:
            continue
        
        label = row[1].strip().lower() if len(row) > 1 else ""
        
        # Week header
        if "week" in label and re.search(r"\d+\s+\w+\s*-", row[1]):
            week_start = parse_week_start(row[1])
            session_notes = []  # Reset session notes for new week
            # Extract week number from header (e.g., "Week 1", "Week 2")
            week_match = re.search(r"week\s+(\d+)", row[1], re.IGNORECASE)
            if week_match:
                week_number = int(week_match.group(1))
            continue
        
        # Session notes (store per day for current week)
        if label == "session notes":
            session_notes = row[2:9]  # Get notes for each day (Monday-Sunday)
            continue
        
        # Activity row
        if label == "activity" and week_start:
            activities = row[2:9]
            
            # Look ahead for purposes and session notes (they come after activity row)
            purposes = []
            local_session_notes = []
            for j in range(i + 1, min(i + 5, len(rows))):  # Look up to 4 rows ahead
                if len(rows[j]) > 1:
                    next_label = rows[j][1].strip().lower()
                    if next_label == "purpose":
                        purposes = rows[j][2:9]
                    elif next_label == "session notes":
                        local_session_notes = rows[j][2:9]
                    elif "week" in next_label:  # Stop if we hit next week
                        break
            
            days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            
            for day_idx, activity in enumerate(activities):
                if not activity or activity.strip().lower() == "rest":
                    continue
                
                date = week_start + timedelta(days=day_idx)
                purpose = purposes[day_idx] if day_idx < len(purposes) else ""
                
                # Get session note for this day (prefer local, fall back to stored)
                session_note = local_session_notes[day_idx] if day_idx < len(local_session_notes) else ""
                if not session_note:
                    session_note = session_notes[day_idx] if day_idx < len(session_notes) else ""
                matched_note = match_session_notes_to_workout(session_note, activity, purpose)
                
                # Check for combined workout (run + strength)
                has_strength = "strength" in activity.lower()
                
                # Create run event
                run_name = re.sub(r"\s+and\s+.*strength.*", "", activity, flags=re.IGNORECASE).strip()
                
                # Build description
                if matched_note:
                    desc = f"Purpose: {purpose}\n\n{matched_note}" if purpose else matched_note
                else:
                    workout_steps = format_workout_steps(run_name)
                    desc = f"Purpose: {purpose}\n\n{workout_steps}" if purpose and workout_steps else (workout_steps or "")
                
                event = {
                    "start_date_local": date.strftime("%Y-%m-%dT00:00:00"),
                    "category": "RACE" if "race" in activity.lower() else "WORKOUT",
                    "type": "Run",
                    "name": run_name,
                    "description": desc.strip(),
                }
                if week_number is not None:
                    event["week_number"] = week_number
                events.append(event)
                
                # Create strength event if needed
                if has_strength:
                    strength_event = {
                        "start_date_local": date.strftime("%Y-%m-%dT00:00:00"),
                        "category": "WORKOUT",
                        "type": "WeightTraining",
                        "name": "Leg Strength",
                        "description": f"Purpose: {purpose}" if purpose else "",
                    }
                    if week_number is not None:
                        strength_event["week_number"] = week_number
                    events.append(strength_event)
    
    return events


# upload_events is now imported from Utils.py


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Upload training plan to intervals.icu")
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
        sheet_name = config["google_sheets"].get("sheet_name")  # Optional: specific tab name
        rows = fetch_sheet(service, config["google_sheets"]["sheet_id"], sheet_name=sheet_name)
    
    # Parse
    events = parse_training_plan(rows)
    
    # Filter by week if specified (week number from the training program, not calculated)
    if args.week:
        events = [e for e in events if e.get("week_number") == args.week]
    
    # Remove week_number field before uploading (it's only for filtering)
    for event in events:
        event.pop("week_number", None)
    
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
