/**
 * Training Plan Uploader for intervals.icu
 * 
 * This Google Apps Script uploads training plans from Google Sheets to intervals.icu
 * 
 * SETUP INSTRUCTIONS:
 * 1. Open your training plan spreadsheet in Google Sheets
 * 2. Go to Extensions > Apps Script
 * 3. Delete any existing code and paste all the code from this file
 * 4. Click Save (Ctrl+S or Cmd+S)
 * 5. Close the Apps Script editor and refresh your spreadsheet
 * 6. You'll see a new "Training Plan" menu appear
 * 7. Click "Training Plan > Settings" to enter your intervals.icu credentials
 * 8. Click "Training Plan > Upload to intervals.icu" to upload your plan
 */

// ============================================================================
// MENU AND UI FUNCTIONS
// ============================================================================

/**
 * Creates custom menu when spreadsheet opens
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Training Plan')
    .addItem('Upload to intervals.icu', 'uploadTrainingPlan')
    .addItem('Upload Specific Week...', 'uploadSpecificWeek')
    .addSeparator()
    .addItem('Preview Events (Dry Run)', 'previewEvents')
    .addSeparator()
    .addItem('Settings', 'showSettings')
    .addItem('Help', 'showHelp')
    .addSeparator()
    .addItem('Refresh Authorization', 'refreshAuthorization')
    .addItem('Setup Auto-Refresh (Run Once)', 'setupDailyTrigger')
    .addToUi();
}

/**
 * Keep-alive function - runs daily to prevent token expiration
 * This function is called by a time-based trigger
 */
function keepAlive() {
  // Simply access the spreadsheet to keep authorization active
  const sheet = SpreadsheetApp.getActiveSpreadsheet();
  const name = sheet ? sheet.getName() : 'Unknown';
  console.log('Keep-alive ping: ' + name + ' at ' + new Date().toISOString());
}

/**
 * Sets up a daily trigger to keep authorization active
 * Only needs to be run once
 */
function setupDailyTrigger() {
  const ui = SpreadsheetApp.getUi();
  
  // Check if trigger already exists
  const triggers = ScriptApp.getProjectTriggers();
  const existingTrigger = triggers.find(t => t.getHandlerFunction() === 'keepAlive');
  
  if (existingTrigger) {
    ui.alert('Auto-Refresh Already Active', 
      'A daily auto-refresh trigger is already set up. No action needed!', 
      ui.ButtonSet.OK);
    return;
  }
  
  // Create daily trigger
  ScriptApp.newTrigger('keepAlive')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();
  
  ui.alert('Auto-Refresh Enabled', 
    'A daily trigger has been set up to keep your authorization active.\n\n' +
    'The script will automatically refresh every day at 6 AM.\n\n' +
    'You only need to do this once!', 
    ui.ButtonSet.OK);
}

/**
 * Manual authorization refresh - use if things stop working
 */
function refreshAuthorization() {
  const ui = SpreadsheetApp.getUi();
  
  // Access various services to refresh their tokens
  const sheet = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getUserProperties();
  
  ui.alert('Authorization Refreshed', 
    'Your authorization has been refreshed successfully!\n\n' +
    'If you continue to have issues, try:\n' +
    '1. Refresh this page (Cmd+R or Ctrl+R)\n' +
    '2. Sign out and back into Google\n' +
    '3. Go to Training Plan → Setup Auto-Refresh', 
    ui.ButtonSet.OK);
}

/**
 * Shows settings dialog using simple prompts
 */
function showSettings() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getUserProperties();
  
  // Get current values
  const currentAthleteId = props.getProperty('INTERVALS_ATHLETE_ID') || '';
  const currentApiKey = props.getProperty('INTERVALS_API_KEY') || '';
  
  // Prompt for Athlete ID
  const athleteResponse = ui.prompt(
    'intervals.icu Settings (1/2)',
    'Enter your Athlete ID (e.g., i12345)\n\nCurrent: ' + (currentAthleteId || '(not set)'),
    ui.ButtonSet.OK_CANCEL
  );
  
  if (athleteResponse.getSelectedButton() !== ui.Button.OK) {
    return;
  }
  
  const athleteId = athleteResponse.getResponseText().trim() || currentAthleteId;
  
  // Prompt for API Key
  const apiResponse = ui.prompt(
    'intervals.icu Settings (2/2)',
    'Enter your API Key\n\nCurrent: ' + (currentApiKey ? '(saved)' : '(not set)'),
    ui.ButtonSet.OK_CANCEL
  );
  
  if (apiResponse.getSelectedButton() !== ui.Button.OK) {
    return;
  }
  
  const apiKey = apiResponse.getResponseText().trim() || currentApiKey;
  
  // Save settings
  if (athleteId && apiKey) {
    props.setProperty('INTERVALS_ATHLETE_ID', athleteId);
    props.setProperty('INTERVALS_API_KEY', apiKey);
    ui.alert('Settings Saved', 'Your intervals.icu credentials have been saved!', ui.ButtonSet.OK);
  } else {
    ui.alert('Error', 'Both Athlete ID and API Key are required.', ui.ButtonSet.OK);
  }
}

/**
 * Shows help information
 */
function showHelp() {
  const ui = SpreadsheetApp.getUi();
  const helpText = 
    'HOW TO USE\n' +
    '══════════\n' +
    '1. Click Training Plan → Settings and enter your intervals.icu credentials\n' +
    '2. Make sure your training plan follows the expected format\n' +
    '3. Click Training Plan → Upload to intervals.icu\n\n' +
    'EXPECTED FORMAT\n' +
    '═══════════════\n' +
    '• Week headers: "Week 1 22 Dec - 28 Dec"\n' +
    '• Row with "Activity" in column B, workouts in columns C-I (Mon-Sun)\n' +
    '• Optional "Purpose" row below Activity\n' +
    '• Optional "Session Notes" row\n\n' +
    'SUPPORTED WORKOUTS\n' +
    '══════════════════\n' +
    '• Recovery: "30 mins Recovery"\n' +
    '• Easy: "45 mins Easy"\n' +
    '• Long run: "90 mins Long Run"\n' +
    '• Intervals: "5x3:00 (60s) Z4"\n' +
    '• Hills: "10x3:00 hills Z3"\n' +
    '• Progression: "12 km Progression"\n\n' +
    'GET YOUR CREDENTIALS\n' +
    '════════════════════\n' +
    '1. Go to intervals.icu\n' +
    '2. Settings → Developer Settings\n' +
    '3. Athlete ID is at the top (e.g., i12345)\n' +
    '4. Click "Create API Key" to generate a key';
  
  ui.alert('Training Plan Uploader - Help', helpText, ui.ButtonSet.OK);
}

/**
 * Prompts user to select a specific week to upload
 */
function uploadSpecificWeek() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Upload Specific Week',
    'Enter the week number to upload (e.g., 1, 2, 3):',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const weekNum = parseInt(response.getResponseText(), 10);
    if (isNaN(weekNum) || weekNum < 1) {
      ui.alert('Invalid week number. Please enter a positive number.');
      return;
    }
    uploadTrainingPlan(weekNum);
  }
}

/**
 * Preview events without uploading
 */
function previewEvents() {
  uploadTrainingPlan(null, true);
}

// ============================================================================
// SETTINGS STORAGE
// ============================================================================

/**
 * Save settings to user properties
 */
function saveSettings(athleteId, apiKey) {
  const props = PropertiesService.getUserProperties();
  props.setProperty('INTERVALS_ATHLETE_ID', athleteId);
  props.setProperty('INTERVALS_API_KEY', apiKey);
}

/**
 * Get settings from user properties
 */
function getSettings() {
  const props = PropertiesService.getUserProperties();
  return {
    athleteId: props.getProperty('INTERVALS_ATHLETE_ID'),
    apiKey: props.getProperty('INTERVALS_API_KEY')
  };
}

// ============================================================================
// MAIN UPLOAD FUNCTION
// ============================================================================

/**
 * Main function to upload training plan to intervals.icu
 * @param {number} weekFilter - Optional week number to filter
 * @param {boolean} dryRun - If true, only preview without uploading
 */
function uploadTrainingPlan(weekFilter, dryRun) {
  const ui = SpreadsheetApp.getUi();
  const settings = getSettings();
  
  // Check settings
  if (!settings.athleteId || !settings.apiKey) {
    ui.alert('Please configure your intervals.icu settings first.\n\nGo to: Training Plan > Settings');
    return;
  }
  
  try {
    // Get active sheet data
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = sheet.getDataRange().getValues();
    
    // Parse training plan
    let events = parseTrainingPlan(data);
    
    // Filter by week if specified
    if (weekFilter) {
      events = events.filter(e => e.weekNumber === weekFilter);
      if (events.length === 0) {
        ui.alert(`No events found for Week ${weekFilter}`);
        return;
      }
    }
    
    // Remove weekNumber from events before upload
    events.forEach(e => delete e.weekNumber);
    
    // Preview
    const summary = events.map(e => 
      `${e.start_date_local.substring(0, 10)} | ${e.name.substring(0, 35).padEnd(35)} | ${e.type}`
    ).join('\n');
    
    if (dryRun) {
      ui.alert(`Preview: Found ${events.length} events\n\n${summary}`);
      return;
    }
    
    // Confirm upload
    const response = ui.alert(
      'Upload Training Plan',
      `Found ${events.length} events to upload:\n\n${summary}\n\nProceed with upload?`,
      ui.ButtonSet.YES_NO
    );
    
    if (response !== ui.Button.YES) {
      return;
    }
    
    // Upload to intervals.icu
    const result = uploadEvents(events, settings.athleteId, settings.apiKey);
    
    if (result.success) {
      ui.alert('Success!', `Successfully uploaded ${events.length} events to intervals.icu!`, ui.ButtonSet.OK);
    } else {
      ui.alert('Upload Failed', `Error: ${result.error}`, ui.ButtonSet.OK);
    }
    
  } catch (error) {
    ui.alert('Error', `An error occurred: ${error.message}`, ui.ButtonSet.OK);
    console.error(error);
  }
}

// ============================================================================
// API UPLOAD
// ============================================================================

/**
 * Upload events to intervals.icu API
 */
function uploadEvents(events, athleteId, apiKey) {
  const url = `https://intervals.icu/api/v1/athlete/${athleteId}/events/bulk`;
  const auth = Utilities.base64Encode(`API_KEY:${apiKey}`);
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': `Basic ${auth}`
    },
    payload: JSON.stringify(events),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    const body = response.getContentText();
    
    if (code === 200) {
      return { success: true };
    } else {
      return { success: false, error: `HTTP ${code}: ${body}` };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================================================
// PARSING FUNCTIONS
// ============================================================================

/**
 * Parse training plan from spreadsheet data
 */
function parseTrainingPlan(rows) {
  const events = [];
  let weekStart = null;
  let weekNumber = null;
  let sessionNotes = [];
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 2) continue;
    
    const label = normalizeSheetText((row[1] || '').toString()).toLowerCase();
    
    // Week header
    if (label.includes('week') && /\d+\s+\w+\s*-/.test(row[1])) {
      weekStart = parseWeekStart(row[1]);
      sessionNotes = [];
      
      const weekMatch = row[1].match(/week\s+(\d+)/i);
      if (weekMatch) {
        weekNumber = parseInt(weekMatch[1], 10);
      }
      continue;
    }
    
    // Session notes
    if (label === 'session notes') {
      sessionNotes = row.slice(2, 9);
      continue;
    }
    
    // Activity row
    if (label === 'activity' && weekStart) {
      const activities = row.slice(2, 9);
      
      // Look ahead for purposes and session notes
      let purposes = [];
      let localSessionNotes = [];
      
      for (let j = i + 1; j < Math.min(i + 5, rows.length); j++) {
        if (rows[j].length > 1) {
          const nextLabel = (rows[j][1] || '').toString().trim().toLowerCase();
          if (nextLabel === 'purpose') {
            purposes = rows[j].slice(2, 9);
          } else if (nextLabel === 'session notes') {
            localSessionNotes = rows[j].slice(2, 9);
          } else if (nextLabel.includes('week')) {
            break;
          }
        }
      }
      
      // Process each day
      for (let dayIdx = 0; dayIdx < activities.length; dayIdx++) {
        const activity = normalizeSheetText((activities[dayIdx] || '').toString());
        if (!activity || activity.toLowerCase() === 'rest') continue;
        
        const date = new Date(weekStart);
        date.setDate(date.getDate() + dayIdx);
        
        const purpose = normalizeSheetText((purposes[dayIdx] || '').toString());
        const sessionNote = normalizeSheetText((localSessionNotes[dayIdx] || sessionNotes[dayIdx] || '').toString());
        const matchedNote = matchSessionNotesToWorkout(sessionNote, activity, purpose);
        
        // Check for combined workout (run + strength)
        const hasStrength = activity.toLowerCase().includes('strength');
        const runName = activity.replace(/\s+and\s+.*strength.*/i, '').trim();
        const eventName = runName;
        
        // Build description
        let desc;
        if (matchedNote) {
          desc = purpose ? `Purpose: ${purpose}\n\n${matchedNote}` : matchedNote;
        } else {
          const workoutSteps = formatWorkoutSteps(runName);
          if (purpose) {
            desc = workoutSteps ? `Purpose: ${purpose}\n\n${workoutSteps}` : `Purpose: ${purpose}`;
          } else {
            desc = workoutSteps || '';
          }
        }
        
        // Create run event
        const event = {
          start_date_local: formatDate(date),
          category: 'WORKOUT',
          type: 'Run',
          name: eventName,
          description: desc.trim()
        };
        
        if (weekNumber !== null) {
          event.weekNumber = weekNumber;
        }
        events.push(event);
        
        // Create strength event if needed
        if (hasStrength) {
          const strengthEvent = {
            start_date_local: formatDate(date),
            category: 'WORKOUT',
            type: 'WeightTraining',
            name: 'Leg Strength',
            description: purpose ? `Purpose: ${purpose}` : ''
          };
          if (weekNumber !== null) {
            strengthEvent.weekNumber = weekNumber;
          }
          events.push(strengthEvent);
        }
      }
    }
  }
  
  return events;
}

/**
 * Normalize sheet text at source to avoid hidden invalid chars
 */
function normalizeSheetText(value) {
  if (!value) return '';
  let text = String(value);
  // Normalize non-breaking spaces and line endings
  text = text.replace(/\u00A0/g, ' ').replace(/\r\n?/g, '\n');
  // Remove control chars except tab/newline
  text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  // Collapse repeated whitespace and trim
  text = text.replace(/[ \t]+/g, ' ').trim();
  // Remove unpaired surrogate code points which can break strict JSON parsers.
  text = text.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '');
  text = text.replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
  return text;
}

/**
 * Parse week start date from text
 */
function parseWeekStart(text) {
  text = text.replace(/[\n\r]/g, ' ').trim();
  
  const months = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
  };
  
  const now = new Date();
  let year = now.getFullYear();
  const currentMonth = now.getMonth();
  let day = null;
  let monthNum = null;
  
  // Try "22 Dec - 28 Dec" format
  let match = text.match(/(\d{1,2})\s+([a-z]+)\s*-/i);
  if (match) {
    day = parseInt(match[1], 10);
    monthNum = months[match[2].toLowerCase().substring(0, 3)];
  } else {
    // Try "jan 2 - jan 8" format
    match = text.match(/([a-z]+)\s+(\d+)\s*-/i);
    if (match) {
      monthNum = months[match[1].toLowerCase().substring(0, 3)];
      day = parseInt(match[2], 10);
    }
  }
  
  if (day === null || monthNum === undefined) {
    return null;
  }
  
  // Handle year rollover only near year boundaries.
  // Example: in Oct-Dec, Jan/Feb/Mar likely belongs to next year.
  if (currentMonth >= 9 && monthNum <= 2) {
    year += 1;
  }
  // Example: in Jan-Mar, Oct/Nov/Dec may belong to previous year.
  else if (currentMonth <= 2 && monthNum >= 9) {
    year -= 1;
  }
  
  return new Date(year, monthNum, day);
}

/**
 * Format date as ISO string for intervals.icu
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T00:00:00`;
}

// ============================================================================
// WORKOUT FORMATTING
// ============================================================================

/**
 * Convert activity text to intervals.icu workout step format
 */
function formatWorkoutSteps(activity) {
  let steps = ['- Warmup\n- 10m Z2 HR'];
  const activityLower = activity.toLowerCase();
  
  // Recovery run
  if (activityLower.includes('recovery')) {
    steps = ['- Warmup'];
    const match = activity.match(/(\d+)\s*mins?/);
    if (match) {
      steps.push(`- ${match[1]}m Z1 HR`);
      steps.push('- Cooldown');
      return steps.join('\n');
    }
  }
  
  // Easy run
  if (activityLower.includes('easy')) {
    steps = ['- Warmup'];
    const match = activity.match(/(\d+)\s*mins?/);
    if (match) {
      steps.push(`- ${match[1]}m Z2 HR`);
      formatStrides(activity, steps);
      steps.push('\n- Cooldown');
      return steps.join('\n');
    }
  }
  
  // Long run
  if (activityLower.includes('long') || activityLower.includes('inc.')) {
    steps = ['- Warmup'];
    const match = activity.match(/(\d+)\s*mins?/);
    if (match) {
      steps.push(`- ${match[1]}m Z2 HR`);
      
      // Check for intervals
      const intervals = activity.match(/[\+\&]\s*(\d+)x(\d+)\s*mins?\s*Z(\d)/i) ||
                       activity.match(/(?:and|with)\s+(\d+)x(\d+)\s*mins?\s*Z(\d)/i) ||
                       (activityLower.includes('inc.') ? activity.match(/(\d+)x(\d+)\s*mins?\s*Z(\d)/i) : null);
      
      if (intervals) {
        const [, reps, dur, zone] = intervals;
        steps.push(`\nIntervals ${reps}x`);
        steps.push(`- ${dur}m Z${zone} HR`);
        steps.push('- 2m Z2 HR Recovery');
      }
      steps.push('\n- 10m Z2 HR');
      steps.push('- Cooldown');
      return steps.join('\n');
    }
  }
  
  // Interval workout: "5x3:00 (60s) Z4"
  const intervalPattern = /(\d+)x([\d:]+)\s*\((\d+)s?\)/g;
  const matches = [...activity.matchAll(intervalPattern)];
  if (matches.length > 0) {
    const zoneMatch = activity.match(/Z(\d)/i);
    const zone = zoneMatch ? zoneMatch[1] : '4';
    
    for (const match of matches) {
      const [, reps, dur, rest] = match;
      const durStr = parseDuration(dur);
      const restSecs = parseInt(rest, 10);
      const restStr = restSecs >= 60 ? `${Math.floor(restSecs / 60)}m` : `${restSecs}s`;
      
      steps.push(`\nIntervals ${reps}x`);
      steps.push(`- ${durStr} Z${zone} HR`);
      steps.push(`- ${restStr} Z1 HR`);
    }
    steps.push('\n- 10m Z2 HR');
    steps.push('- Cooldown');
    return steps.join('\n');
  }
  
  // Progression run
  if (activityLower.includes('progression')) {
    steps = ['- Warmup'];
    const match = activity.match(/(\d+)\s*km/);
    if (match) {
      const segment = Math.floor(parseInt(match[1], 10) / 3);
      steps.push(`- ${segment}km Z1 HR`);
      steps.push(`- ${segment}km Z2 HR`);
      steps.push(`- ${segment}km Z3 HR`);
      steps.push('\n- 10m Z2 HR');
      steps.push('- Cooldown');
      return steps.join('\n');
    }
  }
  
  // Hill workout
  if (activityLower.includes('hill')) {
    steps = ['- Warmup', '- 10m Z2 HR'];
    if (formatHills(activity, steps)) {
      steps.push('\n- 10m Z2 HR');
      steps.push('- Cooldown');
      return steps.join('\n');
    }
  }
  
  return '';
}

/**
 * Parse session notes and convert to structured workout steps
 */
function parseSessionNotes(sessionNote, isInterval) {
  if (!sessionNote) return null;
  
  const steps = [];
  const noteLower = sessionNote.toLowerCase();
  
  const zoneMap = {
    'rest': 'Z1', 'recovery': 'Z1', 'steady jog': 'Z1', 'walk': 'Z1',
    'easy': 'Z2', 'steady': 'Z2', 'moderate': 'Z2',
    'tempo': 'Z3', 'marathon': 'Z3',
    'threshold': 'Z4', 'hard': 'Z4', 'vo2max': 'Z4', 'fast': 'Z4',
    'sprint': 'Z5'
  };
  
  // Split by newlines or /
  let parts;
  if (sessionNote.includes('\n')) {
    parts = sessionNote.split('\n').map(p => p.trim()).filter(p => p);
  } else {
    parts = sessionNote.split(/\s*\/\s*/);
  }
  
  // Extract title
  let title = null;
  if (parts[0].includes(':')) {
    const titleParts = parts[0].split(':');
    title = titleParts[0].trim();
    parts[0] = titleParts.slice(1).join(':').trim();
  }
  
  // Check for warmup/cooldown in notes
  const hasWarmup = parts.some(p => /warmup|warm up/i.test(p));
  const hasCooldown = parts.some(p => /cooldown|cool down/i.test(p));
  
  // Check if interval workout
  if (!isInterval) {
    isInterval = parts.some(p => /(\d+)x([\d:]+)/.test(p)) || noteLower.includes('interval');
  }
  
  if (title) {
    steps.push(`${title}:`);
    steps.push('');
  }
  
  // Add warmup
  if (!hasWarmup) {
    steps.push(isInterval ? '- Warmup\n- 10m Z2 HR' : '- Warmup');
  }
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;
    
    const partLower = part.toLowerCase();
    
    // Warmup/cooldown
    if (/warmup|warm up/i.test(partLower)) {
      steps.push(isInterval ? '- Warmup\n- 10m Z2 HR' : '- Warmup');
      continue;
    }
    if (/cooldown|cool down/i.test(partLower)) {
      steps.push(isInterval ? '\n- Cooldown 10m Z2 HR' : '- Cooldown');
      continue;
    }
    
    // Multiple intervals with +
    if (part.includes('+')) {
      const intervalParts = part.split('+').map(p => p.trim()).filter(p => p);
      for (const intervalPart of intervalParts) {
        const intervalMatch = intervalPart.match(/(\d+)x([\d:]+)\s*(?:min|mins|minute|minutes)?/i);
        if (intervalMatch) {
          const [, reps, durationRaw] = intervalMatch;
          const duration = parseDuration(durationRaw);
          const zone = getZone(intervalPart, '', 'Z4');
          const recoveryStr = getRecovery(intervalPart);
          
          steps.push(`\nIntervals ${reps}x`);
          steps.push(`- ${duration} ${zone} HR`);
          if (recoveryStr) {
            steps.push(`- ${recoveryStr} Z1 HR`);
          }
        }
      }
      continue;
    }
    
    // Single interval pattern
    const intervalMatch = partLower.match(/(\d+)x([\d:]+)\s*(?:min|mins|minute|minutes)?/);
    if (intervalMatch) {
      const [, reps, durationRaw] = intervalMatch;
      const duration = parseDuration(durationRaw);
      const nextPart = i + 1 < parts.length ? parts[i + 1] : null;
      const recoveryStr = getRecovery(part, true, nextPart);
      
      // Check for zone progression
      const progressionMatch = partLower.match(/first\s+(\d+)\s+reps?\s+in\s+zone\s*(\d).*?final\s+(\d+)\s+reps?\s+in\s+zone\s*(\d)/);
      
      if (progressionMatch) {
        const [, firstReps, firstZone, finalReps, finalZone] = progressionMatch;
        
        steps.push(`\nIntervals ${firstReps}x`);
        steps.push(`- ${duration} Z${firstZone} HR`);
        if (recoveryStr) steps.push(`- ${recoveryStr} Z1 HR`);
        
        steps.push(`\nIntervals ${finalReps}x`);
        steps.push(`- ${duration} Z${finalZone} HR`);
        if (recoveryStr) steps.push(`- ${recoveryStr} Z1 HR`);
      } else {
        const zone = getZone(part, '', 'Z4');
        steps.push(`\nIntervals ${reps}x`);
        steps.push(`- ${duration} ${zone} HR`);
        if (recoveryStr) {
          steps.push(`- ${recoveryStr} Z1 HR`);
        }
      }
      
      // Skip recovery part if in next part
      if (recoveryStr && !partLower.includes(recoveryStr.toLowerCase()) && nextPart) {
        i++;
      }
      continue;
    }
    
    // Simple duration with zone
    const durationMatch = partLower.match(/(\d+)\s*(?:min|mins|minute|minutes)/);
    if (durationMatch) {
      const duration = durationMatch[1];
      let zone = getZone(part, '', 'Z2');
      
      for (const [keyword, z] of Object.entries(zoneMap)) {
        if (partLower.includes(keyword)) {
          zone = z;
          break;
        }
      }
      steps.push(`- ${duration}m ${zone} HR`);
      continue;
    }
    
    // Distance with zone
    const kmMatch = partLower.match(/(\d+)\s*km/);
    if (kmMatch) {
      const distance = kmMatch[1];
      const zone = getZone(part, '', 'Z2');
      steps.push(`- ${distance}km ${zone} HR`);
      continue;
    }
    
    // Fallback
    if (part && !part.endsWith(':') && /\d/.test(part)) {
      steps.push(`- ${part}`);
    }
  }
  
  // Add cooldown
  if (!hasCooldown) {
    steps.push(isInterval ? '\n- Cooldown 10m Z2 HR' : '- Cooldown');
  }
  
  return steps.length > 0 ? steps.join('\n') : null;
}

/**
 * Match session notes to workout
 */
function matchSessionNotesToWorkout(sessionNote, activity, purpose) {
  if (!sessionNote) return null;
  
  const activityLower = activity.toLowerCase();
  const sessionNoteLower = sessionNote.toLowerCase();
  const purposeLower = (purpose || '').toLowerCase();
  
  // Don't match to recovery runs
  if (activityLower.includes('recovery')) return null;
  
  // Hills use auto-generated format
  if (activityLower.includes('hill')) return null;
  
  // Interval session
  if (sessionNoteLower.includes('interval')) {
    if ((activityLower.includes('x') && activity.includes(':')) || 
        purposeLower.includes('vo2max') || purposeLower.includes('threshold')) {
      return parseSessionNotes(sessionNote, true);
    }
    return null;
  }
  
  // Long run
  if (sessionNoteLower.includes('long run') && 
      (activityLower.includes('long') || activityLower.includes('inc.'))) {
    return parseSessionNotes(sessionNote, false);
  }
  
  // Progression
  if (sessionNoteLower.includes('progression') && activityLower.includes('progression')) {
    return parseSessionNotes(sessionNote, false);
  }
  
  // Fallback
  if (sessionNote.trim() && !activityLower.includes('recovery')) {
    if (sessionNoteLower.includes('hill') && !activityLower.includes('hill')) return null;
    if (sessionNoteLower.includes('long run') && !activityLower.includes('long') && !activityLower.includes('inc.')) return null;
    
    const isIntervalWorkout = (activityLower.includes('x') && activity.includes(':')) || 
                              purposeLower.includes('vo2max') || purposeLower.includes('threshold');
    return parseSessionNotes(sessionNote, isIntervalWorkout);
  }
  
  return null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse duration string
 */
function parseDuration(durationRaw) {
  if (durationRaw.includes(':')) {
    const parts = durationRaw.split(':');
    const mins = parseInt(parts[0], 10);
    const secs = parts.length > 1 ? parseInt(parts[1], 10) : 0;
    return secs > 0 ? `${mins}m${secs}s` : `${mins}m`;
  }
  if (durationRaw.endsWith('m')) return durationRaw;
  return `${durationRaw}m`;
}

/**
 * Extract zone from text
 */
function getZone(text, purpose, defaultZone) {
  const textLower = text.toLowerCase();
  const purposeLower = (purpose || '').toLowerCase();
  
  // Zone ranges
  let zoneMatch = textLower.match(/zones?\s*(\d)(?:\s*-\s*(\d))?/);
  if (zoneMatch) return `Z${zoneMatch[1]}`;
  
  // Single zone
  zoneMatch = textLower.match(/zone\s*(\d)/) || text.match(/\bZ(\d)\b/i);
  if (zoneMatch) return `Z${zoneMatch[1]}`;
  
  // Keywords
  if (textLower.includes('recovery') || purposeLower.includes('recovery')) return 'Z1';
  if (textLower.includes('easy') || purposeLower.includes('easy')) return 'Z2';
  if (textLower.includes('tempo') || purposeLower.includes('tempo')) return 'Z3';
  if (textLower.includes('threshold') || purposeLower.includes('threshold')) return 'Z4';
  if (textLower.includes('sprint') || purposeLower.includes('sprint')) return 'Z5';
  
  return defaultZone;
}

/**
 * Extract recovery duration from text
 */
function getRecovery(text, checkNext, nextPart) {
  let recoveryMatch = text.toLowerCase().match(
    /(?:\+|with|and|all with)\s+(\d+)\s*(min|mins|minute|minutes|sec|secs|second|seconds)?\s*(?:jog|walk|recovery|rest)/
  );
  
  if (!recoveryMatch && checkNext && nextPart) {
    recoveryMatch = nextPart.toLowerCase().match(
      /(\d+)\s*(min|mins|minute|minutes|sec|secs|second|seconds)?\s*(?:jog|walk|recovery|rest)/
    );
  }
  
  if (recoveryMatch) {
    const dur = recoveryMatch[1];
    const unit = recoveryMatch[2] || '';
    if (unit.includes('sec')) return `${dur}s`;
    return `${dur}m`;
  }
  
  if (text.toLowerCase().includes('jog recovery') || text.toLowerCase().includes('steady jog')) {
    return '2m';
  }
  
  return null;
}

/**
 * Format strides for easy runs
 */
function formatStrides(activity, steps) {
  // "& Strides 5x10sec + 50sec rest"
  let stridesMatch = activity.match(/(?:&|strides)\s+(\d+)x(\d+)sec\s*\+\s*(\d+)sec\s*rest/i);
  if (stridesMatch) {
    const [, reps, strideDur, recoveryDur] = stridesMatch;
    steps.push(`\nStrides ${reps}x`);
    steps.push(`- ${strideDur}s Z5 HR`);
    steps.push(`- ${recoveryDur}s Z1 HR Recovery`);
    return true;
  }
  
  // "5x10 secs strides"
  stridesMatch = activity.match(/(\d+)x(\d+)\s*secs?\s*strides/i);
  if (stridesMatch) {
    const [, reps, strideDur] = stridesMatch;
    steps.push(`\nStrides ${reps}x`);
    steps.push(`- ${strideDur}s Z5 HR`);
    steps.push('- 50s Z1 HR Recovery');
    return true;
  }
  
  // "+ Strides" generic
  if (/[+&]\s*strides/i.test(activity)) {
    steps.push('\nStrides 4x');
    steps.push('- 10s Z5 HR');
    steps.push('- 50s Z1 HR Recovery');
    return true;
  }
  
  return false;
}

/**
 * Format hill repeats
 */
function formatHills(activity, steps) {
  if (!/hills?/i.test(activity)) return false;
  
  const match = activity.match(/(\d+)x([\d:]+)/);
  if (match) {
    const [, reps, dur] = match;
    const zone = getZone(activity, '', 'Z4');
    const durStr = parseDuration(dur).replace('s', '');
    
    steps.push(`\nHills ${reps}x`);
    steps.push(`- ${durStr} ${zone} HR Uphill`);
    steps.push(`- ${durStr} Z1 HR jog back`);
    return true;
  }
  return false;
}
