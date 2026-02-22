import * as vscode from 'vscode';

const questions = require('../questions.json');

export function activate(context: vscode.ExtensionContext) {

  const disposable = vscode.commands.registerCommand(
    'blindcoding.generateQuestion',
    async () => {

      // Step 1: Ask difficulty
      const difficulty = await vscode.window.showQuickPick(
        ["Easy", "Medium", "Hard"],
        { placeHolder: "Select Difficulty" }
      );

      if (!difficulty) return;

      // Step 2: Filter questions
      const filtered = questions.filter(
        (q:any) => q.difficulty === difficulty
      );

      if (filtered.length === 0) {
        vscode.window.showErrorMessage("No questions found.");
        return;
      }

      // Step 3: Pick question
      const selected =
        filtered[Math.floor(Math.random() * filtered.length)];

      // Step 4: Create editor content
      const content = `
Blind Coding Question

Title: ${selected.title}
Difficulty: ${selected.difficulty}
Topic: ${selected.topic}

${selected.description}
`;

      const doc = await vscode.workspace.openTextDocument({
        content,
        language: "plaintext"
      });

      vscode.window.showTextDocument(doc);
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}