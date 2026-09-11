'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const { ipcRenderer } = require('electron');

function getRootDir() {
  return process.defaultApp ? path.resolve(__dirname, '..', '..') : path.dirname(process.execPath);
}

const bookmarksPath = path.join(getRootDir(), 'UserData', 'bookmarks.json');

function loadBookmarksFile() {
  try {
    if (!fs.existsSync(bookmarksPath)) return [];
    return JSON.parse(fs.readFileSync(bookmarksPath, 'utf8'));
  } catch (_error) {
    return [];
  }
}

function saveBookmarksFile(bookmarks) {
  try {
    const safe = bookmarks && typeof bookmarks === 'object' ? bookmarks : [];
    fs.mkdirSync(path.dirname(bookmarksPath), { recursive: true });
    const tempPath = bookmarksPath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(safe, null, 2), 'utf8');
    if (fs.existsSync(bookmarksPath)) fs.unlinkSync(bookmarksPath);
    fs.renameSync(tempPath, bookmarksPath);
    return true;
  } catch (_error) {
    return false;
  }
}

function runPowerShell(script, extraEnv) {
  try {
    return childProcess.spawnSync(
      'powershell.exe',
      ['-NoProfile', '-STA', '-WindowStyle', 'Hidden', '-Command', script],
      {
        encoding: 'utf8',
        windowsHide: true,
        env: Object.assign({}, process.env, extraEnv || {}),
        maxBuffer: 1024 * 1024
      }
    );
  } catch (_error) {
    return null;
  }
}

function nativePrompt(message, defaultValue) {
  const script = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "Add-Type -AssemblyName System.Drawing",
    "$form = New-Object System.Windows.Forms.Form",
    "$form.Text = 'DK Flash Browser'",
    "$form.StartPosition = 'CenterScreen'",
    "$form.FormBorderStyle = 'FixedDialog'",
    "$form.MaximizeBox = $false",
    "$form.MinimizeBox = $false",
    "$form.TopMost = $true",
    "$form.ClientSize = New-Object System.Drawing.Size(460,132)",
    "$label = New-Object System.Windows.Forms.Label",
    "$label.AutoSize = $false",
    "$label.Location = New-Object System.Drawing.Point(12,12)",
    "$label.Size = New-Object System.Drawing.Size(436,32)",
    "$label.Text = $env:DK_PROMPT_MESSAGE",
    "$form.Controls.Add($label)",
    "$box = New-Object System.Windows.Forms.TextBox",
    "$box.Location = New-Object System.Drawing.Point(12,48)",
    "$box.Size = New-Object System.Drawing.Size(436,23)",
    "$box.Text = $env:DK_PROMPT_DEFAULT",
    "$form.Controls.Add($box)",
    "$ok = New-Object System.Windows.Forms.Button",
    "$ok.Text = '확인'",
    "$ok.DialogResult = [System.Windows.Forms.DialogResult]::OK",
    "$ok.Location = New-Object System.Drawing.Point(292,91)",
    "$ok.Size = New-Object System.Drawing.Size(75,28)",
    "$form.Controls.Add($ok)",
    "$cancel = New-Object System.Windows.Forms.Button",
    "$cancel.Text = '취소'",
    "$cancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel",
    "$cancel.Location = New-Object System.Drawing.Point(373,91)",
    "$cancel.Size = New-Object System.Drawing.Size(75,28)",
    "$form.Controls.Add($cancel)",
    "$form.AcceptButton = $ok",
    "$form.CancelButton = $cancel",
    "$form.Add_Shown({ $box.SelectAll(); $box.Focus() })",
    "$result = $form.ShowDialog()",
    "if ($result -eq [System.Windows.Forms.DialogResult]::OK) {",
    "  $bytes = [System.Text.Encoding]::UTF8.GetBytes($box.Text)",
    "  [Console]::Write('OK:' + [Convert]::ToBase64String($bytes))",
    "} else { [Console]::Write('CANCEL') }"
  ].join('; ');

  const result = runPowerShell(script, {
    DK_PROMPT_MESSAGE: String(message || ''),
    DK_PROMPT_DEFAULT: String(defaultValue == null ? '' : defaultValue)
  });
  if (!result || result.error || result.status !== 0) return null;
  const output = String(result.stdout || '').trim();
  if (output === 'CANCEL') return null;
  if (!output.startsWith('OK:')) return null;
  try {
    return Buffer.from(output.slice(3), 'base64').toString('utf8');
  } catch (_error) {
    return null;
  }
}

function nativeConfirm(message) {
  const script = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "$result = [System.Windows.Forms.MessageBox]::Show($env:DK_CONFIRM_MESSAGE, 'DK Flash Browser', [System.Windows.Forms.MessageBoxButtons]::YesNo, [System.Windows.Forms.MessageBoxIcon]::Question, [System.Windows.Forms.MessageBoxDefaultButton]::Button2)",
    "if ($result -eq [System.Windows.Forms.DialogResult]::Yes) { [Console]::Write('YES') } else { [Console]::Write('NO') }"
  ].join('; ');
  const result = runPowerShell(script, { DK_CONFIRM_MESSAGE: String(message || '') });
  return !!result && !result.error && result.status === 0 && String(result.stdout || '').trim() === 'YES';
}

// Electron 6 does not provide a usable renderer window.prompt/confirm path for
// this browser chrome. Replace only the chrome window dialogs with synchronous
// native Windows dialogs; page content lives in separate BrowserViews.
window.prompt = function (message, defaultValue) {
  return nativePrompt(message, defaultValue);
};
window.confirm = function (message) {
  return nativeConfirm(message);
};

window.dkBrowser = {
  send: function (channel, payload) {
    ipcRenderer.send(channel, payload);
  },
  on: function (channel, handler) {
    ipcRenderer.on(channel, function (_event, payload) {
      handler(payload);
    });
  },
  loadBookmarks: loadBookmarksFile,
  saveBookmarks: saveBookmarksFile
};
