#!/usr/bin/env python3
"""
Shared utilities for training plan uploaders.
"""

import json
import base64
import requests
import os
import pickle
import re
from datetime import datetime
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build


def load_config(path=None):
    """Load configuration from JSON file."""
    if path is None:
        # Default to Configs/config.json relative to Scripts folder
        script_dir = os.path.dirname(os.path.abspath(__file__))
        path = os.path.join(script_dir, "..", "Configs", "config.json")
    with open(path) as f:
        return json.load(f)


def get_sheets_service(token_file=None, config_path=None):
    """Get Google Sheets service, handling OAuth authentication if needed."""
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']
    
    # Default paths
    if token_file is None:
        token_file = os.path.join(script_dir, "..", "Configs", "token.pickle")
    if config_path is None:
        config_path = os.path.join(script_dir, "..", "Configs", "config.json")
    
    creds = None
    
    # Try to load existing token
    if os.path.exists(token_file):
        try:
            with open(token_file, 'rb') as token:
                creds = pickle.load(token)
        except Exception:
            creds = None
    
    # Try to refresh if expired
    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            with open(token_file, 'wb') as token:
                pickle.dump(creds, token)
        except Exception:
            # Token refresh failed (revoked/expired), need to re-authenticate
            creds = None
    
    # If no valid credentials, run OAuth flow
    if not creds or not creds.valid:
        # Load OAuth credentials from config.json
        with open(config_path) as f:
            config = json.load(f)
        
        oauth_creds = config.get("Oauth Credentials")
        if not oauth_creds:
            raise Exception("OAuth credentials not found in config.json. Add 'Oauth Credentials' section.")
        
        # Create a temporary credentials file for the flow
        import tempfile
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as tmp:
            json.dump(oauth_creds, tmp)
            tmp_path = tmp.name
        
        try:
            flow = InstalledAppFlow.from_client_secrets_file(tmp_path, SCOPES)
            creds = flow.run_local_server(port=0)
        finally:
            os.unlink(tmp_path)
        
        # Save the new token
        with open(token_file, 'wb') as token:
            pickle.dump(creds, token)
        print("New OAuth token saved!")
    
    return build("sheets", "v4", credentials=creds)


def fetch_sheet(service, sheet_id, sheet_name=None):
    """Fetch data from a specific sheet tab."""
    
    if sheet_name:
        try:
            return service.spreadsheets().values().get(
                spreadsheetId=sheet_id, range=sheet_name
            ).execute().get("values", [])
        except Exception as e:
            raise Exception(f"Could not access sheet tab '{sheet_name}'. Error: {e}")
    
    # Get the first sheet from the spreadsheet
    spreadsheet = service.spreadsheets().get(spreadsheetId=sheet_id).execute()
    sheets = spreadsheet.get('sheets', [])
    if not sheets:
        raise Exception("No sheets found in the spreadsheet")
    
    # Use the first sheet
    sheet_name = sheets[0]['properties']['title']
    print(f"Using first sheet: {sheet_name}")
    return service.spreadsheets().values().get(
        spreadsheetId=sheet_id, range=sheet_name
    ).execute().get("values", [])


def upload_events(events, athlete_id, api_key, upsert=False):
    """Upload events to intervals.icu."""

    auth = base64.b64encode(f"API_KEY:{api_key}".encode()).decode()
    url = f"https://intervals.icu/api/v1/athlete/{athlete_id}/events/bulk"
    if upsert:
        url += "?upsert=true"
    headers = {"Authorization": f"Basic {auth}", "Content-Type": "application/json"}

    response = requests.post(url, headers=headers, json=events)
    return response.status_code == 200, response.text


def generate_external_id(athlete_id, date_str, workout_name):
    """Generate a deterministic external_id for upsert support."""
    date = date_str[:10]
    slug = re.sub(r'[^a-z0-9]+', '_', workout_name.lower()).strip('_')
    return f"{athlete_id}_{date}_{slug}"


def parse_week_start(text):
    """Parse week start date from text format"""

    text = text.replace('\n', ' ').replace('\r', ' ').strip()
    
    months = {"jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
              "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12}
    
    year = datetime.now().year
    current_month = datetime.now().month
    day, month_num = None, None
    
    # Try "22 Dec - 28 Dec" format (day first)
    match = re.search(r"(\d{1,2})\s+([a-z]+)\s*-", text, re.IGNORECASE)
    if match:
        day = int(match.group(1))
        month_num = months.get(match.group(2).lower()[:3], 1)
    else:
        # Try "jan 2 - jan 8" format (month first)
        match = re.search(r"([a-z]+)\s+(\d+)\s*-", text, re.IGNORECASE)
        if match:
            month_num = months.get(match.group(1).lower()[:3], 1)
            day = int(match.group(2))
    
    if not day or not month_num:
        return None
    
    # Handle year rollover only near year boundaries.
    # Example: in Oct-Dec, Jan/Feb/Mar likely belongs to next year.
    if current_month >= 10 and month_num <= 3:
        year += 1
    # Example: in Jan-Mar, Oct/Nov/Dec may belong to previous year.
    elif current_month <= 3 and month_num >= 10:
        year -= 1
    
    try:
        return datetime(year, month_num, day)
    except:
        return None


# Workout parsing helpers

def parse_duration(duration_raw):
    """Parse duration string (e.g., "3:00" -> "3m", "1:15" -> "1m15s", "5" -> "5m")."""
    
    if ":" in duration_raw:
        parts = duration_raw.split(":")
        mins, secs = int(parts[0]), int(parts[1]) if len(parts) > 1 else 0
        return f"{mins}m{secs}s" if secs > 0 else f"{mins}m"
    # If already ends with 'm', return as-is (for parse_session_notes compatibility)
    if duration_raw.endswith("m"):
        return duration_raw
    return f"{duration_raw}m"


def get_zone(text, purpose="", default="Z2"):
    """Extract zone from text."""
    
    text_lower = text.lower()
    purpose_lower = purpose.lower() if purpose else ""
    
    # Check for zone ranges first (e.g., "Zones 3-4")
    zone_match = re.search(r"zones?\s*(\d)(?:\s*-\s*(\d))?", text_lower)
    if zone_match:
        return f"Z{zone_match.group(1)}"
    
    # Check for single zone number ("Zone 3" or "Z3")
    zone_match = re.search(r"zone\s*(\d)", text_lower) or re.search(r"\bZ(\d)\b", text, re.IGNORECASE)
    if zone_match:
        return f"Z{zone_match.group(1)}"
    
    # Check keywords (for simple plan compatibility)
    if "recovery" in text_lower or "recovery" in purpose_lower:
        return "Z1"
    if "easy" in text_lower or "easy" in purpose_lower:
        return "Z2"
    if "tempo" in text_lower or "tempo" in purpose_lower:
        return "Z3"
    if "threshold" in text_lower or "threshold" in purpose_lower:
        return "Z4"
    if "sprint" in text_lower or "sprint" in purpose_lower:
        return "Z5"
    
    return default


def get_recovery(text, check_next=False, next_part=None):
    """Extract recovery duration from text."""
    
    recovery_match = re.search(
        r"(?:\+|with|and|all with)\s+(\d+)\s*(min|mins|minute|minutes|sec|secs|second|seconds)?\s*(?:jog|walk|recovery|rest)",
        text.lower()
    )
    
    if not recovery_match and check_next and next_part:
        recovery_match = re.search(
            r"(\d+)\s*(min|mins|minute|minutes|sec|secs|second|seconds)?\s*(?:jog|walk|recovery|rest)",
            next_part.lower()
        )
    
    if recovery_match:
        dur = recovery_match.group(1)
        unit = recovery_match.group(2) if recovery_match.lastindex > 1 else None
        if unit and ("sec" in unit.lower() or "second" in unit.lower()):
            return f"{dur}s"
        return f"{dur}m"
    
    # Check for implicit recovery phrases
    if "jog recovery" in text.lower() or "steady jog" in text.lower():
        return "2m"
    
    return None


def format_strides(activity, steps):
    """Format strides for easy runs. Adds strides steps if found."""
    
    # Match format: "& Strides 5x10sec + 50sec rest" or "Strides 5x10sec + 50sec rest"
    strides_match = re.search(r"(?:&|strides)\s+(\d+)x(\d+)sec\s*\+\s*(\d+)sec\s*rest", activity, re.IGNORECASE)
    if strides_match:
        reps = strides_match.group(1)
        stride_dur = strides_match.group(2)
        recovery_dur = strides_match.group(3)
        steps.append(f"\nStrides {reps}x")
        steps.append(f"- {stride_dur}s Z5 HR")
        steps.append(f"- {recovery_dur}s Z1 HR Recovery")
        return True
    
    # Match format: "5x10 secs strides" or "+ 5x10 secs strides"
    strides_match2 = re.search(r"(\d+)x(\d+)\s*secs?\s*strides", activity, re.IGNORECASE)
    if strides_match2:
        reps = strides_match2.group(1)
        stride_dur = strides_match2.group(2)
        steps.append(f"\nStrides {reps}x")
        steps.append(f"- {stride_dur}s Z5 HR")
        steps.append("- 50s Z1 HR Recovery")
        return True
    
    # Match generic "+ Strides" or "& Strides" pattern (default to 4x10s)
    if re.search(r"[+&]\s*strides", activity, re.IGNORECASE):
        steps.append(f"\nStrides 4x")
        steps.append(f"- 10s Z5 HR")
        steps.append("- 50s Z1 HR Recovery")
        return True
    
    return False


def format_hills(activity, steps, purpose=""):
    """Format hill repeats. Adds hill steps if found."""
    
    if "hills" not in activity.lower() and "hill" not in activity.lower():
        return False
    
    match = re.search(r"(\d+)x([\d:]+)", activity)
    if match:
        zone = get_zone(activity, purpose, "Z4")
        # get_zone returns "Z3" format, use directly
        reps, dur = match.groups()
        dur_str = parse_duration(dur).replace("s", "")  # Remove seconds for hills
        steps.extend([
            f"\nHills {reps}x",
            f"- {dur_str} {zone} HR Uphill",
            f"- {dur_str} Z1 HR jog back"
        ])
        return True
    return False

