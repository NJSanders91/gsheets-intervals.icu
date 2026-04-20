/**
 * Athlete Training Plan Uploader for intervals.icu
 *
 * For individual athletes to upload their own training plan from Google Sheets.
 * Reads from the active sheet tab — no roster or coach features needed.
 *
 * SETUP:
 * 1. Extensions > Apps Script > paste this code > Save
 * 2. Refresh spreadsheet - "Training Plan" menu appears
 * 3. Training Plan > Settings > enter your Athlete ID and API key
 * 4. Training Plan > Upload to intervals.icu
 */

// ============================================================================
// MENU AND UI
// ============================================================================

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Training Plan')
    .addItem('Upload to intervals.icu', 'uploadAll')
    .addItem('Upload Specific Week...', 'uploadSpecificWeek')
    .addSeparator()
    .addItem('Preview Events', 'previewEvents')
    .addSeparator()
    .addItem('Settings', 'showSettings')
    .addItem('Help', 'showHelp')
    .addSeparator()
    .addItem('Refresh Authorization', 'refreshAuthorization')
    .addItem('Setup Auto-Refresh (Run Once)', 'setupDailyTrigger')
    .addToUi();
}

function keepAlive() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet();
  console.log('Keep-alive ping: ' + (sheet ? sheet.getName() : 'Unknown') + ' at ' + new Date().toISOString());
}

function setupDailyTrigger() {
  const ui = SpreadsheetApp.getUi();
  const existing = ScriptApp.getProjectTriggers().find(t => t.getHandlerFunction() === 'keepAlive');

  if (existing) {
    ui.alert('Auto-Refresh Already Active',
      'A daily auto-refresh trigger is already set up. No action needed!',
      ui.ButtonSet.OK);
    return;
  }

  ScriptApp.newTrigger('keepAlive').timeBased().everyDays(1).atHour(6).create();

  ui.alert('Auto-Refresh Enabled',
    'A daily trigger has been set up to keep your authorization active.\n' +
    'The script will automatically refresh every day at 6 AM.\n' +
    'You only need to do this once!',
    ui.ButtonSet.OK);
}

function refreshAuthorization() {
  SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getUserProperties();
  SpreadsheetApp.getUi().alert('Authorization Refreshed',
    'Your authorization has been refreshed successfully!\n\n' +
    'If you continue to have issues, try:\n' +
    '1. Refresh this page (Cmd+R or Ctrl+R)\n' +
    '2. Sign out and back into Google\n' +
    '3. Go to Training Plan > Setup Auto-Refresh',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

function showSettings() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getUserProperties();

  const currentId = props.getProperty('ATHLETE_ID') || '';
  const currentKey = props.getProperty('INTERVALS_API_KEY') || '';

  const idResponse = ui.prompt(
    'Athlete ID',
    'Enter your intervals.icu Athlete ID (e.g., i12345)\n\n' +
    'Find it in your intervals.icu profile URL.\n\n' +
    'Current: ' + (currentId || '(not set)'),
    ui.ButtonSet.OK_CANCEL
  );
  if (idResponse.getSelectedButton() !== ui.Button.OK) return;
  const athleteId = idResponse.getResponseText().trim() || currentId;

  const keyResponse = ui.prompt(
    'API Key',
    'Enter your intervals.icu API Key\n\n' +
    'Find it at: intervals.icu > Settings > Developer Settings\n\n' +
    'Current: ' + (currentKey ? '(saved)' : '(not set)'),
    ui.ButtonSet.OK_CANCEL
  );
  if (keyResponse.getSelectedButton() !== ui.Button.OK) return;
  const apiKey = keyResponse.getResponseText().trim() || currentKey;

  if (athleteId && apiKey) {
    props.setProperty('ATHLETE_ID', athleteId);
    props.setProperty('INTERVALS_API_KEY', apiKey);
    ui.alert('Settings Saved', 'Your Athlete ID and API key have been saved!', ui.ButtonSet.OK);
  } else {
    ui.alert('Error', 'Both Athlete ID and API Key are required.', ui.ButtonSet.OK);
  }
}

function showHelp() {
  SpreadsheetApp.getUi().alert('Help',
    'ATHLETE TRAINING PLAN UPLOADER\n' +
    '══════════════════════════════\n\n' +
    'SETUP\n' +
    '─────\n' +
    '1. Create a free intervals.icu account\n' +
    '2. Connect Garmin: Settings > Connections\n' +
    '3. Get your API key: Settings > Developer Settings\n' +
    '4. Get your Athlete ID from your profile URL (e.g., i12345)\n' +
    '5. Click Training Plan > Settings and enter both\n\n' +
    'UPLOADING\n' +
    '─────────\n' +
    '- Upload to intervals.icu — uploads all weeks from the active tab\n' +
    '- Upload Specific Week — pick a single week to upload\n' +
    '- Preview Events — see what will be uploaded without uploading\n' +
    '- Re-uploading is safe: workouts are updated in place (no duplicates)\n\n' +
    'PLAN FORMAT\n' +
    '───────────\n' +
    '- Week headers: "Week 1 22 Dec - 28 Dec"\n' +
    '- Row with "Activity" in column B, workouts in columns C-I (Mon-Sun)\n' +
    '- Optional "Purpose" and "Session Notes" rows\n' +
    '- See the example sheet for formatting details',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

// ============================================================================
// UPLOAD ORCHESTRATION
// ============================================================================

function getSettings() {
  const props = PropertiesService.getUserProperties();
  return {
    athleteId: props.getProperty('ATHLETE_ID'),
    apiKey: props.getProperty('INTERVALS_API_KEY')
  };
}

function checkSettings() {
  const settings = getSettings();
  if (!settings.athleteId || !settings.apiKey) {
    SpreadsheetApp.getUi().alert('Please configure your Athlete ID and API key first.\n\nGo to: Training Plan > Settings');
    return null;
  }
  return settings;
}

function uploadAll() {
  const settings = checkSettings();
  if (!settings) return;
  runUpload(settings, null);
}

function uploadSpecificWeek() {
  const ui = SpreadsheetApp.getUi();
  const settings = checkSettings();
  if (!settings) return;

  const response = ui.prompt(
    'Upload Specific Week',
    'Enter the week number to upload:',
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK) return;

  const weekNum = parseInt(response.getResponseText().trim(), 10);
  if (isNaN(weekNum) || weekNum < 1) {
    ui.alert('Invalid week number.');
    return;
  }

  runUpload(settings, weekNum);
}

function previewEvents() {
  const ui = SpreadsheetApp.getUi();
  const settings = checkSettings();
  if (!settings) return;

  const data = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().getDataRange().getValues();
  let events = parseTrainingPlan(data);

  if (events.length === 0) {
    ui.alert('No events found in the active sheet.');
    return;
  }

  const summary = events.map(e =>
    `${e.start_date_local.substring(0, 10)} | ${e.name.substring(0, 35).padEnd(35)} | ${e.type}`
  ).join('\n');

  ui.alert(`Preview: ${events.length} events\n\n${summary}`);
}

function runUpload(settings, weekFilter) {
  const ui = SpreadsheetApp.getUi();
  const data = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().getDataRange().getValues();
  let events = parseTrainingPlan(data);

  if (weekFilter) {
    events = events.filter(e => e.weekNumber === weekFilter);
  }

  if (events.length === 0) {
    const msg = weekFilter ? `No events found for week ${weekFilter}.` : 'No events found in the active sheet.';
    ui.alert(msg);
    return;
  }

  events.forEach(e => {
    e.external_id = generateExternalId(settings.athleteId, e.start_date_local, e.name, e.type);
    delete e.weekNumber;
  });

  const weekLabel = weekFilter ? ` (Week ${weekFilter})` : '';
  const eventLines = events.map(e =>
    `${e.start_date_local.substring(0, 10)} | ${e.name.substring(0, 35).padEnd(35)} | ${e.type}`
  ).join('\n');

  const confirm = ui.alert(`Upload${weekLabel} — ${events.length} events`,
    eventLines + '\n\nProceed with upload?',
    ui.ButtonSet.YES_NO);
  if (confirm !== ui.Button.YES) return;

  const result = uploadEvents(events, settings.athleteId, settings.apiKey);

  if (result.success) {
    ui.alert('Success', `Uploaded ${events.length} events to intervals.icu!`, ui.ButtonSet.OK);
  } else {
    ui.alert('Upload Failed', `Error: ${result.error}`, ui.ButtonSet.OK);
  }
}

// ============================================================================
// API UPLOAD
// ============================================================================

function uploadEvents(events, athleteId, apiKey) {
  const url = `https://intervals.icu/api/v1/athlete/${athleteId}/events/bulk?upsert=true`;
  const auth = Utilities.base64Encode(`API_KEY:${apiKey}`);

  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': `Basic ${auth}` },
      payload: JSON.stringify(events),
      muteHttpExceptions: true
    });

    const code = response.getResponseCode();
    if (code === 200) return { success: true };
    return { success: false, error: `HTTP ${code}: ${response.getContentText()}` };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function generateExternalId(athleteId, dateStr, workoutName, eventType) {
  const date = dateStr.substring(0, 10);
  const slug = workoutName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const type = (eventType || 'run').toLowerCase();
  return `${athleteId}_${date}_${type}_${slug}`;
}

// ============================================================================
// PARSING
// ============================================================================

function parseTrainingPlan(rows) {
  const events = [];
  let weekStart = null;
  let weekNumber = null;
  let sessionNotes = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 2) continue;

    const label = normalizeSheetText((row[1] || '').toString()).toLowerCase();

    if (label.includes('week') && /\d+\s+\w+\s*-/.test(row[1])) {
      weekStart = parseWeekStart(row[1]);
      sessionNotes = [];

      const weekMatch = row[1].match(/week\s+(\d+)/i);
      if (weekMatch) weekNumber = parseInt(weekMatch[1], 10);
      continue;
    }

    if (label === 'session notes') {
      sessionNotes = row.slice(2, 9);
      continue;
    }

    if (label === 'activity' && weekStart) {
      const activities = row.slice(2, 9);
      let purposes = [];
      let localSessionNotes = [];

      for (let j = i + 1; j < Math.min(i + 10, rows.length); j++) {
        if (rows[j].length > 1) {
          const nextLabel = (rows[j][1] || '').toString().trim().toLowerCase();
          if (nextLabel === 'purpose') purposes = rows[j].slice(2, 9);
          else if (nextLabel === 'session notes') localSessionNotes = rows[j].slice(2, 9);
          else if (nextLabel.includes('week')) break;
        }
      }

      for (let dayIdx = 0; dayIdx < activities.length; dayIdx++) {
        const activity = normalizeSheetText((activities[dayIdx] || '').toString());
        if (!activity || activity.toLowerCase() === 'rest') continue;

        const date = new Date(weekStart);
        date.setDate(date.getDate() + dayIdx);

        const purpose = normalizeSheetText((purposes[dayIdx] || '').toString());
        const sessionNote = normalizeSheetText((localSessionNotes[dayIdx] || sessionNotes[dayIdx] || '').toString());
        const matchedNote = matchSessionNotesToWorkout(sessionNote, activity, purpose);

        const hasStrength = activity.toLowerCase().includes('strength');
        const runName = activity.replace(/\s+and\s+.*strength.*/i, '').trim();

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

        const event = {
          start_date_local: formatDate(date),
          category: 'WORKOUT',
          type: 'Run',
          name: runName,
          description: desc.trim()
        };
        if (weekNumber !== null) event.weekNumber = weekNumber;
        events.push(event);

        if (hasStrength) {
          const strengthEvent = {
            start_date_local: formatDate(date),
            category: 'WORKOUT',
            type: 'WeightTraining',
            name: 'Leg Strength',
            description: purpose ? `Purpose: ${purpose}` : ''
          };
          if (weekNumber !== null) strengthEvent.weekNumber = weekNumber;
          events.push(strengthEvent);
        }
      }
    }
  }

  return events;
}

function normalizeSheetText(value) {
  if (!value) return '';
  let text = String(value);
  text = text.replace(/\u00A0/g, ' ').replace(/\r\n?/g, '\n');
  text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  text = text.replace(/[ \t]+/g, ' ').trim();
  text = text.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '');
  text = text.replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
  return text;
}

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

  let match = text.match(/(\d{1,2})\s+([a-z]+)\s*-/i);
  if (match) {
    day = parseInt(match[1], 10);
    monthNum = months[match[2].toLowerCase().substring(0, 3)];
  } else {
    match = text.match(/([a-z]+)\s+(\d+)\s*-/i);
    if (match) {
      monthNum = months[match[1].toLowerCase().substring(0, 3)];
      day = parseInt(match[2], 10);
    }
  }

  if (day === null || monthNum === undefined) return null;

  if (currentMonth >= 9 && monthNum <= 2) year += 1;
  else if (currentMonth <= 2 && monthNum >= 9) year -= 1;

  return new Date(year, monthNum, day);
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T00:00:00`;
}

// ============================================================================
// WORKOUT FORMATTING
// ============================================================================

function formatWorkoutSteps(activity) {
  let steps = ['- Warmup\n- 10m Z2 HR'];
  const activityLower = activity.toLowerCase();

  if (activityLower.includes('recovery')) {
    steps = ['- Warmup'];
    const match = activity.match(/(\d+)\s*mins?/);
    if (match) {
      steps.push(`- ${match[1]}m Z1 HR`);
      steps.push('- Cooldown');
      return steps.join('\n');
    }
  }

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

  if (activityLower.includes('long') || activityLower.includes('inc.')) {
    steps = ['- Warmup'];
    const match = activity.match(/(\d+)\s*mins?/);
    if (match) {
      steps.push(`- ${match[1]}m Z2 HR`);

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

  let parts;
  if (sessionNote.includes('\n')) {
    parts = sessionNote.split('\n').map(p => p.trim()).filter(p => p);
  } else {
    parts = sessionNote.split(/\s*\/\s*/);
  }

  let title = null;
  if (parts[0].includes(':')) {
    const titleParts = parts[0].split(':');
    title = titleParts[0].trim();
    parts[0] = titleParts.slice(1).join(':').trim();
  }

  const hasWarmup = parts.some(p => /warmup|warm up/i.test(p));
  const hasCooldown = parts.some(p => /cooldown|cool down/i.test(p));

  if (!isInterval) {
    isInterval = parts.some(p => /(\d+)x([\d:]+)/.test(p)) || noteLower.includes('interval');
  }

  if (title) {
    steps.push(`${title}:`);
    steps.push('');
  }

  if (!hasWarmup) {
    steps.push(isInterval ? '- Warmup\n- 10m Z2 HR' : '- Warmup');
  }

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;

    const partLower = part.toLowerCase();

    if (/warmup|warm up/i.test(partLower)) {
      steps.push(isInterval ? '- Warmup\n- 10m Z2 HR' : '- Warmup');
      continue;
    }
    if (/cooldown|cool down/i.test(partLower)) {
      steps.push(isInterval ? '\n- Cooldown 10m Z2 HR' : '- Cooldown');
      continue;
    }

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
          if (recoveryStr) steps.push(`- ${recoveryStr} Z1 HR`);
        }
      }
      continue;
    }

    const intervalMatch = partLower.match(/(\d+)x([\d:]+)\s*(?:min|mins|minute|minutes)?/);
    if (intervalMatch) {
      const [, reps, durationRaw] = intervalMatch;
      const duration = parseDuration(durationRaw);
      const nextPart = i + 1 < parts.length ? parts[i + 1] : null;
      const recoveryStr = getRecovery(part, true, nextPart);

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
        if (recoveryStr) steps.push(`- ${recoveryStr} Z1 HR`);
      }

      if (recoveryStr && !partLower.includes(recoveryStr.toLowerCase()) && nextPart) i++;
      continue;
    }

    const durationMatch = partLower.match(/(\d+)\s*(?:min|mins|minute|minutes)/);
    if (durationMatch) {
      const duration = durationMatch[1];
      let zone = getZone(part, '', 'Z2');
      for (const [keyword, z] of Object.entries(zoneMap)) {
        if (partLower.includes(keyword)) { zone = z; break; }
      }
      steps.push(`- ${duration}m ${zone} HR`);
      continue;
    }

    const kmMatch = partLower.match(/(\d+)\s*km/);
    if (kmMatch) {
      steps.push(`- ${kmMatch[1]}km ${getZone(part, '', 'Z2')} HR`);
      continue;
    }

    if (part && !part.endsWith(':') && /\d/.test(part)) {
      steps.push(`- ${part}`);
    }
  }

  if (!hasCooldown) {
    steps.push(isInterval ? '\n- Cooldown 10m Z2 HR' : '- Cooldown');
  }

  return steps.length > 0 ? steps.join('\n') : null;
}

function matchSessionNotesToWorkout(sessionNote, activity, purpose) {
  if (!sessionNote) return null;

  const activityLower = activity.toLowerCase();
  const sessionNoteLower = sessionNote.toLowerCase();
  const purposeLower = (purpose || '').toLowerCase();

  if (activityLower.includes('recovery')) return null;
  if (activityLower.includes('hill')) return null;

  if (sessionNoteLower.includes('interval')) {
    if ((activityLower.includes('x') && activity.includes(':')) ||
        purposeLower.includes('vo2max') || purposeLower.includes('threshold')) {
      return parseSessionNotes(sessionNote, true);
    }
    return null;
  }

  if (sessionNoteLower.includes('long run') &&
      (activityLower.includes('long') || activityLower.includes('inc.'))) {
    return parseSessionNotes(sessionNote, false);
  }

  if (sessionNoteLower.includes('progression') && activityLower.includes('progression')) {
    return parseSessionNotes(sessionNote, false);
  }

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
// HELPERS
// ============================================================================

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

function getZone(text, purpose, defaultZone) {
  const textLower = text.toLowerCase();
  const purposeLower = (purpose || '').toLowerCase();

  let zoneMatch = textLower.match(/zones?\s*(\d)(?:\s*-\s*(\d))?/);
  if (zoneMatch) return `Z${zoneMatch[1]}`;

  zoneMatch = textLower.match(/zone\s*(\d)/) || text.match(/\bZ(\d)\b/i);
  if (zoneMatch) return `Z${zoneMatch[1]}`;

  if (textLower.includes('recovery') || purposeLower.includes('recovery')) return 'Z1';
  if (textLower.includes('easy') || purposeLower.includes('easy')) return 'Z2';
  if (textLower.includes('tempo') || purposeLower.includes('tempo')) return 'Z3';
  if (textLower.includes('threshold') || purposeLower.includes('threshold')) return 'Z4';
  if (textLower.includes('sprint') || purposeLower.includes('sprint')) return 'Z5';

  return defaultZone;
}

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

function formatStrides(activity, steps) {
  let stridesMatch = activity.match(/(?:&|strides)\s+(\d+)x(\d+)sec\s*\+\s*(\d+)sec\s*rest/i);
  if (stridesMatch) {
    const [, reps, strideDur, recoveryDur] = stridesMatch;
    steps.push(`\nStrides ${reps}x`);
    steps.push(`- ${strideDur}s Z5 HR`);
    steps.push(`- ${recoveryDur}s Z1 HR Recovery`);
    return true;
  }

  stridesMatch = activity.match(/(\d+)x(\d+)\s*secs?\s*strides/i);
  if (stridesMatch) {
    const [, reps, strideDur] = stridesMatch;
    steps.push(`\nStrides ${reps}x`);
    steps.push(`- ${strideDur}s Z5 HR`);
    steps.push('- 50s Z1 HR Recovery');
    return true;
  }

  if (/[+&]\s*strides/i.test(activity)) {
    steps.push('\nStrides 4x');
    steps.push('- 10s Z5 HR');
    steps.push('- 50s Z1 HR Recovery');
    return true;
  }

  return false;
}

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
