import * as vscode from 'vscode';
import * as os from 'os';
import * as nodePath from 'path';
import * as fs from 'fs';

const allQuestions: Question[] = require('../questions.json');

interface Question {
  title: string;
  difficulty: string;
  topic: string;
  description: string;
}

/** Pick `count` random items from an array (Fisher-Yates shuffle slice). */
function pickRandom<T>(arr: T[], count: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

/** Select 5 random questions: 2 Easy, 1 Medium, 2 Hard */
function selectQuestions(): Question[] {
  const easy = allQuestions.filter(q => q.difficulty === 'Easy');
  const medium = allQuestions.filter(q => q.difficulty === 'Medium');
  const hard = allQuestions.filter(q => q.difficulty === 'Hard');

  return [
    ...pickRandom(easy, 2),
    ...pickRandom(medium, 1),
    ...pickRandom(hard, 2),
  ];
}

/** Build the HTML for the webview panel */
function getWebviewHtml(questions: Question[], submittedTitles: Set<string>): string {
  const difficultyColors: Record<string, string> = {
    Easy: '#00b8a3',
    Medium: '#ffc01e',
    Hard: '#ff375f',
  };

  const questionCards = questions
    .map((q, i) => {
      const color = difficultyColors[q.difficulty] || '#888';
      const submitted = submittedTitles.has(q.title);
      const btn = submitted
        ? `<button class="start-btn submitted" disabled data-title="${q.title}">&#10003; Submitted</button>`
        : `<button class="start-btn" data-index="${i}" data-title="${q.title}">Start Coding &rarr;</button>`;
      return `
      <div class="card${submitted ? ' card-done' : ''}" id="card-${i}">
        <div class="card-header">
          <span class="index">#${i + 1}</span>
          <span class="badge" style="background:${color}">${q.difficulty}</span>
          <span class="topic">${q.topic}</span>
        </div>
        <h2 class="title">${q.title}</h2>
        <p class="desc">${q.description}</p>
        ${btn}
      </div>`;
    })
    .join('\n');

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Blind Coding</title>
  <style>
    :root {
      --bg: #1e1e2e;
      --card-bg: #282840;
      --text: #cdd6f4;
      --muted: #a6adc8;
      --border: #45475a;
      --accent: #89b4fa;
    }
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 32px 24px;
    }
    .header {
      text-align: center;
      margin-bottom: 36px;
    }
    .header h1 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 6px;
      color: var(--accent);
    }
    .header p {
      color: var(--muted);
      font-size: 14px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 20px;
      max-width: 960px;
      margin: 0 auto;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px 24px;
      display: flex;
      flex-direction: column;
      transition: border-color 0.2s;
    }
    .card:hover { border-color: var(--accent); }
    .card-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }
    .index {
      font-weight: 700;
      font-size: 13px;
      color: var(--muted);
    }
    .badge {
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      color: #fff;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .topic {
      margin-left: auto;
      font-size: 12px;
      color: var(--muted);
      background: rgba(255,255,255,0.06);
      padding: 3px 10px;
      border-radius: 20px;
    }
    .title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .desc {
      font-size: 13px;
      color: var(--muted);
      line-height: 1.6;
      flex: 1;
      margin-bottom: 16px;
    }
    .start-btn {
      align-self: flex-start;
      background: var(--accent);
      color: #1e1e2e;
      border: none;
      padding: 8px 20px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .start-btn:hover { opacity: 0.85; }
    .start-btn.submitted {
      background: #313244;
      color: #a6e3a1;
      cursor: not-allowed;
      opacity: 1;
    }
    .card-done {
      border-color: #a6e3a1 !important;
      opacity: 0.7;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>&#128187; Blind Coding Challenge</h1>
    <p>5 random questions &mdash; 2 Easy &bull; 1 Medium &bull; 2 Hard</p>
  </div>

  <div class="grid">
    ${questionCards}
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    document.querySelectorAll('.start-btn:not(.submitted)').forEach(btn => {
      btn.addEventListener('click', () => {
        vscode.postMessage({ type: 'startCoding', index: Number(btn.dataset.index) });
      });
    });

    // Listen for submission events from the extension to lock the card live
    window.addEventListener('message', (e) => {
      if (e.data.type !== 'markSubmitted') { return; }
      const title = e.data.title;
      document.querySelectorAll('.start-btn').forEach(btn => {
        if (btn.dataset.title === title) {
          btn.textContent = '\u2713 Submitted';
          btn.disabled = true;
          btn.classList.add('submitted');
          btn.closest('.card').classList.add('card-done');
        }
      });
    });
  </script>
</body>
</html>`;
}

/** Build the HTML for the blind coding answer panel */
function getCodingViewHtml(q: Question): string {
  const difficultyColors: Record<string, string> = {
    Easy: '#00b8a3',
    Medium: '#ffc01e',
    Hard: '#ff375f',
  };
  const color = difficultyColors[q.difficulty] || '#888';

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Blind Coding – ${q.title}</title>
  <style>
    :root {
      --bg: #1e1e2e;
      --section-bg: #282840;
      --answer-bg: #12121e;
      --text: #cdd6f4;
      --muted: #a6adc8;
      --border: #45475a;
      --accent: #89b4fa;
      --locked: #f38ba8;
    }
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { height: 100%; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    /* ── Question section (locked) ── */
    .question-pane {
      background: var(--section-bg);
      border-bottom: 2px solid var(--border);
      padding: 20px 28px;
      flex-shrink: 0;
    }
    .question-pane .top-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }
    .badge {
      padding: 3px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      color: #fff;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: ${color};
    }
    .topic-tag {
      font-size: 12px;
      color: var(--muted);
      background: rgba(255,255,255,0.06);
      padding: 3px 10px;
      border-radius: 20px;
    }
    .lock-icon {
      margin-left: auto;
      font-size: 12px;
      color: var(--locked);
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .question-title {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .question-desc {
      font-size: 13px;
      color: var(--muted);
      line-height: 1.7;
      user-select: none;
    }

    /* ── Answer section ── */
    .answer-pane {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      padding: 0;
    }
    .answer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 28px;
      background: var(--section-bg);
      border-bottom: 1px solid var(--border);
      font-size: 12px;
      color: var(--muted);
    }
    .char-count { font-size: 11px; color: var(--muted); }
    #codeArea {
      flex: 1;
      background: var(--answer-bg);
      color: #5a5a8a;          /* faint so masked chars are barely visible */
      caret-color: var(--accent);
      border: none;
      outline: none;
      padding: 20px 28px;
      font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
      font-size: 14px;
      line-height: 1.7;
      resize: none;
      width: 100%;
      height: 100%;
      -webkit-text-security: disc;  /* masks every character as ● natively */
      letter-spacing: 1px;
    }
    .footer {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 14px 28px;
      background: var(--section-bg);
      border-top: 1px solid var(--border);
    }
    .submit-btn {
      background: var(--accent);
      color: #1e1e2e;
      border: none;
      padding: 10px 28px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .submit-btn:hover { opacity: 0.85; }
    .submit-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .hint { font-size: 12px; color: var(--muted); }
  </style>
</head>
<body>

  <!-- LOCKED QUESTION -->
  <div class="question-pane" id="questionPane">
    <div class="top-row">
      <span class="badge">${q.difficulty}</span>
      <span class="topic-tag">${q.topic}</span>
      <span class="lock-icon">&#128274; Read-only</span>
    </div>
    <div class="question-title">${q.title}</div>
    <div class="question-desc">${q.description}</div>
  </div>

  <!-- ANSWER SECTION -->
  <div class="answer-pane">
    <div class="answer-header">
      <span>&#9679;&#9679;&#9679; Your answer is hidden as you type</span>
      <span class="char-count" id="charCount">0 chars</span>
    </div>
    <textarea id="codeArea" placeholder="Start typing your solution here…" spellcheck="false" autocorrect="off" autocapitalize="off"></textarea>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <button class="submit-btn" id="submitBtn" disabled>Submit Answer</button>
    <span class="hint">Your code is hidden while typing. It will be saved securely on submit.</span>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const codeArea = document.getElementById('codeArea');
    const submitBtn = document.getElementById('submitBtn');
    const charCount = document.getElementById('charCount');

    // Block right-click and text selection on the question pane
    const qPane = document.getElementById('questionPane');
    qPane.addEventListener('contextmenu', e => e.preventDefault());
    qPane.addEventListener('selectstart', e => e.preventDefault());

    // Tab key inserts 4 spaces instead of moving focus
    codeArea.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const s = codeArea.selectionStart;
        const v = codeArea.value;
        codeArea.value = v.slice(0, s) + '    ' + v.slice(codeArea.selectionEnd);
        codeArea.selectionStart = codeArea.selectionEnd = s + 4;
        updateCount();
      }
    });

    // Update char count & submit button state on every input
    codeArea.addEventListener('input', updateCount);

    function updateCount() {
      const len = codeArea.value.length;
      charCount.textContent = len + ' char' + (len !== 1 ? 's' : '');
      submitBtn.disabled = codeArea.value.trim().length === 0;
    }

    // Submit — send the real value directly (CSS masks the display, not the value)
    submitBtn.addEventListener('click', () => {
      if (!codeArea.value.trim()) return;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting\u2026';
      vscode.postMessage({ type: 'submitAnswer', code: codeArea.value });
    });

    // Receive confirmation from extension
    window.addEventListener('message', (e) => {
      if (e.data.type === 'submitOk') {
        submitBtn.textContent = '\u2713 Submitted';
        codeArea.disabled = true;
      }
    });
  </script>
</body>
</html>`;
}

/** Open the blind-coding answer panel for a question */
async function openCodingView(q: Question, context: vscode.ExtensionContext, onSubmitted: (title: string) => void) {
  const panel = vscode.window.createWebviewPanel(
    'blindCodingAnswer',
    `\u25CF ${q.title}`,
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true }
  );

  panel.webview.html = getCodingViewHtml(q);

  panel.webview.onDidReceiveMessage(
    async (msg) => {
      if (msg.type !== 'submitAnswer') { return; }

      try {
        // Always save to a fixed folder in the user's home directory
        // so maintainers can find submissions on any lab machine
        const username = os.userInfo().username;
        const submissionsDir = nodePath.join(os.homedir(), 'BlindCodingSubmissions');
        if (!fs.existsSync(submissionsDir)) {
          fs.mkdirSync(submissionsDir, { recursive: true });
        }

        const safeName = q.title.replace(/[^a-zA-Z0-9]/g, '_');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `${username}_${safeName}_${timestamp}.js`;
        const filePath = nodePath.join(submissionsDir, fileName);

        const header = [
          `// Student    : ${username}`,
          `// Question   : ${q.title}`,
          `// Difficulty : ${q.difficulty}`,
          `// Topic      : ${q.topic}`,
          `// Submitted  : ${new Date().toLocaleString()}`,
          `// ──────────────────────────────────────────`,
          '',
        ].join('\n');

        fs.writeFileSync(filePath, header + msg.code, 'utf-8');

        panel.webview.postMessage({ type: 'submitOk' });
        onSubmitted(q.title);
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to save answer: ${err}`);
      }
    },
    undefined,
    context.subscriptions
  );
}

export function activate(context: vscode.ExtensionContext) {
  let currentPanel: vscode.WebviewPanel | undefined;
  let currentQuestions: Question[] = [];
  const submittedTitles = new Set<string>();

  function showPanel() {
    currentQuestions = selectQuestions();

    if (currentPanel) {
      currentPanel.webview.html = getWebviewHtml(currentQuestions, submittedTitles);
      currentPanel.reveal();
      return;
    }

    currentPanel = vscode.window.createWebviewPanel(
      'blindCoding',
      'Blind Coding',
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    currentPanel.webview.html = getWebviewHtml(currentQuestions, submittedTitles);

    currentPanel.webview.onDidReceiveMessage(
      async (msg) => {
        if (msg.type === 'startCoding') {
          const q = currentQuestions[msg.index];
          if (!q || submittedTitles.has(q.title)) { return; }
          await openCodingView(q, context, (title) => {
            submittedTitles.add(title);
            // Push the lock update to the questions panel immediately
            currentPanel?.webview.postMessage({ type: 'markSubmitted', title });
          });
        }
      },
      undefined,
      context.subscriptions
    );

    currentPanel.onDidDispose(() => { currentPanel = undefined; }, null, context.subscriptions);
  }

  // Show the questions panel on activation
  showPanel();

  // Command: re-open / refresh the panel
  context.subscriptions.push(
    vscode.commands.registerCommand('blindcoding.showQuestions', showPanel)
  );

  // Legacy command: pick difficulty → random question in editor
  context.subscriptions.push(
    vscode.commands.registerCommand('blindcoding.generateQuestion', async () => {
      const difficulty = await vscode.window.showQuickPick(
        ['Easy', 'Medium', 'Hard'],
        { placeHolder: 'Select Difficulty' }
      );
      if (!difficulty) { return; }

      const filtered = allQuestions.filter(q => q.difficulty === difficulty);
      if (filtered.length === 0) {
        vscode.window.showErrorMessage('No questions found.');
        return;
      }
      const selected = filtered[Math.floor(Math.random() * filtered.length)];
      await openCodingView(selected, context, () => {});
    })
  );
}

export function deactivate() {}