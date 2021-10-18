import * as vscode from 'vscode';
import { CsvimEditorProvider } from './csvimEditor';

export function activate(context: vscode.ExtensionContext) {
	// Register our custom editor providers
	context.subscriptions.push(CsvimEditorProvider.register(context));
}