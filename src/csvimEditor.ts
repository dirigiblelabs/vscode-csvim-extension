import { Disposable, disposeAll } from './dispose';
import * as vscode from 'vscode';
import { getNonce } from './util';

type csvimProperties = Array<{
	name: string,
	visible: boolean,
	table: string,
	schema: string,
	file: string,
	header: boolean,
	useHeaderNames: boolean,
	delimField: string,
	delimEnclosing: string,
	distinguishEmptyFromNull: boolean,
	keys: Array<{ column: string, values: Array<string> }>
}>;

export class CsvimEditorProvider implements vscode.CustomTextEditorProvider {

	private static readonly viewType = 'csvim.editor';

	public static register(context: vscode.ExtensionContext): vscode.Disposable {
		const provider = new CsvimEditorProvider(context);
		const providerRegistration = vscode.window.registerCustomEditorProvider(CsvimEditorProvider.viewType, provider);
		return providerRegistration;
	}

	constructor(
		private readonly context: vscode.ExtensionContext
	) { }

	public async resolveCustomTextEditor(
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void> {
		webviewPanel.webview.options = {
			enableScripts: true,
		};
		webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

		const updateWebview = () => {
			webviewPanel.webview.postMessage({
				type: 'update',
				json: this.getDocumentAsJson(document)
			});
		};

		const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
			if (e.document.uri.toString() === document.uri.toString()) {
				updateWebview();
			}
		});

		// Make sure we get rid of the listener when our editor is closed.
		webviewPanel.onDidDispose(() => {
			changeDocumentSubscription.dispose();
		});

		// Receive message from the webview.
		webviewPanel.webview.onDidReceiveMessage(e => {
			switch (e.type) {
				case 'add':
					// this.addNewScratch(document);
					return;
				case 'update':
					this.updateTextDocument(document, e.json);
					return;
				case 'open':
					this.openCsv(e.text);
					return;
				case 'delete':
					// this.deleteScratch(document, e.id);
					return;
			}
		});

		updateWebview();
	}

	private openCsv(csvPath: string) {
		const workspaces: any = vscode.workspace.workspaceFolders || [];
		let openPath: string;
		if (workspaces.length > 0) {
			console.log(Object.keys(workspaces[0].uri));
			console.log(workspaces[0].uri.path);
			openPath = workspaces[0].uri.path;
			openPath += csvPath.slice(workspaces[0].name.length + 1);
			vscode.workspace.openTextDocument(openPath).then(doc => {
				vscode.window.showTextDocument(doc);
			});
		}
	}

	private getHtmlForWebview(webview: vscode.Webview): string {
		// Local path to script and css for the webview
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'media', 'csvimEditor.js'));

		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'media', 'vscode.css'));

		const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'media', 'csvim.css'));

		const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));

		// Use a nonce to whitelist which scripts can be run
		const nonce = getNonce();

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
                <title>CSVIM Editor</title>
				<!--
				Use a content security policy to only allow loading images from https or from our extension directory,
				and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'self' 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${styleVSCodeUri}" rel="stylesheet" />
				<link href="${codiconsUri}" rel="stylesheet" />
				<link href="${styleMainUri}" rel="stylesheet" />
			</head>
			<body class="editor-body">
				<div class="toolbar">
					<input type="text" id="search" placeholder="Search">
					<span class="line"></span>
					<span class="spacer small"></span>
					<button type="button" title="Open" id="openCsv"><i class="codicon codicon-link-external"></i>Open</button>
					<button type="button" title="Edit" id="editToggle"><i class="codicon codicon-edit"></i>Edit</button>
					<button type="button" title="Delete"><i class="codicon codicon-trash"></i>Delete</button>
				</div>
				<div class="panel-container">
					<div class="side-panel">
						<div class="item-list">
						</div>
						<button type="button" title="Add New File">Add New File</button>
					</div>
					<div class="main-panel invisible">
						<div class="panel-item row">
							<label for="table">Table</label>
							<input type="text" id="table" class="user-input" placeholder="SomeTableName" disabled>
						</div>
						<div class="panel-item row">
							<label for="schema">Schema</label>
							<input type="text" id="schema" class="user-input" placeholder="SomeSchemaName" disabled>
						</div>
						<div class="panel-item row">
							<label for="filepath">File path</label>
							<input type="text" id="filepath" class="user-input" placeholder="/path/to/file.csv" disabled>
						</div>
						<div class="panel-item column">
							<div class="checkbox">
								<i class="codicon codicon-check"></i>
								<input type="checkbox" id="header" class="user-input" disabled>
							</div>
							<label for="header">Header</label>
						</div>
						<div class="panel-item column">
							<div class="checkbox">
								<i class="codicon codicon-check"></i>
								<input type="checkbox" id="headerNames" class="user-input" disabled>
							</div>
							<label for="headerNames">Use header names</label>
						</div>
						<div class="panel-item column">
							<div class="checkbox">
								<i class="codicon codicon-check"></i>
								<input type="checkbox" id="distinguishEmptyFromNull" class="user-input" disabled>
							</div>
							<label for="distinguishEmptyFromNull">Distinguish empty from null</label>
						</div>
						<div class="panel-item column">
							<div class="panel-item row">
								<label for="delimiter">Delimiter</label>
								<div class="dropdown">
									<select name="Delimiter" id="delimiter" class="user-input" disabled>
									</select>
									<i class="codicon codicon-chevron-down"></i>
								</div>
								<label id="error-delimiter" class="error-label invisible">This delimiter is not supported!</label>
							</div>
							<span class="spacer big"></span>
							<div class="panel-item row">
								<label for="quotechar">Quote character</label>
								<div class="dropdown">
									<select name="Quote character" id="quotechar" class="user-input" disabled>
									</select>
									<i class="codicon codicon-chevron-down"></i>
								</div>
								<label id="error-quotechar" class="error-label invisible">This quote character is not supported!</label>
							</div>
						</div>
						<div class="panel-item row">
							<label for="keys">Keys</label>
							<table id="keys">
								<thead>
									<tr>
										<th>Column</th>
										<th>Values</th>
									</tr>
								</thead>
								<tbody id="keys-body">
								</tbody>
								<tfoot class="user-input invisible">
									<tr>
										<td colspan="2">
											<button type="button" class="icon-with-text" title="Add Column Row"><i class="codicon codicon-add"></i> Add Column Row</button>
										</td>
									</tr>
								</tfoot>
							</table>
						</div>
					</div>
					<div class="no-files-panel">
						<p class="text-center">No files.</p>
						<p class="text-center">Create a new file entry.</p>
					</div>
				</div>

				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}

	/**
	 * Parse the csvim document to JSON
	 */
	private getDocumentAsJson(document: vscode.TextDocument): Array<any> {
		const text = document.getText();
		if (text.trim().length === 0) {
			return [];
		}

		try {
			return JSON.parse(text);
		} catch {
			throw new Error('Could not get document as json. Content is not valid json');
		}
	}

	/**
	 * Write out the json to a given document.
	 */
	private updateTextDocument(document: vscode.TextDocument, json: any) {
		const edit = new vscode.WorkspaceEdit();

		// Just replace the entire document every time for this example extension.
		// A more complete extension should compute minimal edits instead.
		edit.replace(
			document.uri,
			new vscode.Range(0, 0, document.lineCount, 0),
			JSON.stringify(json, null, 2));

		return vscode.workspace.applyEdit(edit);
	}
}
