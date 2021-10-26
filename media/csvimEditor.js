// @ts-check

(function () {
	// @ts-ignore
	const vscode = acquireVsCodeApi();

	let inputIsValid = true;
	let columnIsUnique = true;
	let valueIsUnique = true;
	let searchMatches = [];

	const delimiterList = [',', '\\t', '|', ';', '#'];
	const quoteCharList = ["'", "\"", "#"];
	const tableRegex = '^[A-Za-z0-9_\\-$.]+$';
	const schemaRegex = '^[A-Za-z0-9_\\-$.]+$';
	const filepathRegex = '^[\\w\\-. /$]+$';
	const keysRegex = '^[A-Za-z0-9_\\-$.]+$';

	const emptyFileContiner = /** @type {HTMLElement} */ (document.querySelector('.no-files-panel'));
	const mainPanel = /** @type {HTMLElement} */ (document.querySelector('.main-panel'));
	const itemList = /** @type {HTMLElement} */ (document.querySelector('.item-list'));

	const search = /** @type {HTMLInputElement} */ (document.getElementById('search'));

	const openButton = /** @type {HTMLButtonElement} */ (document.getElementById('openCsv'));
	const editButton = /** @type {HTMLButtonElement} */ (document.getElementById('editToggle'));
	const deleteButton = /** @type {HTMLButtonElement} */ (document.getElementById('deleteEntry'));

	const table = /** @type {HTMLInputElement} */ (document.getElementById('table'));
	const schema = /** @type {HTMLInputElement} */ (document.getElementById('schema'));
	const filepath = /** @type {HTMLInputElement} */ (document.getElementById('filepath'));
	const header = /** @type {HTMLInputElement} */ (document.getElementById('header'));
	const headerNames = /** @type {HTMLInputElement} */ (document.getElementById('headerNames'));
	const distinguishEmptyFromNull = /** @type {HTMLInputElement} */ (document.getElementById('distinguishEmptyFromNull'));
	const delimiter = /** @type {HTMLSelectElement} */ (document.getElementById('delimiter'));
	const quotechar = /** @type {HTMLSelectElement} */ (document.getElementById('quotechar'));
	const keys = /** @type {HTMLTableElement} */ (document.getElementById('keys-body'));
	const errorLabelDelimiter = /** @type {HTMLElement} */ (document.getElementById('error-delimiter'));
	const errorLabelQuoteChar = /** @type {HTMLElement} */ (document.getElementById('error-quotechar'));

	// Webviews are normally torn down when not visible and re-created when they become visible again.
	// State lets us save information across these re-loads
	const state = vscode.getState() || {};
	if (state.editMode === undefined) {
		state.editMode = false;
	} else if (state.editMode) {
		setEditMode(state.editMode, false);
	}
	if (state.document) {
		updateContent();
	} else {
		state.activeItemNumber = 0;
	}

	function compareKeys(/** @type {Object} */ first, /** @type {Object} */ second) {
		if (first.column < second.column) return -1;
		else if (first.column > second.column) return 1;
		return 0;
	}

	function sendError(/** @type {string} */ message) {
		vscode.postMessage({
			type: 'error',
			text: message
		});
	}

	function updateDocument() {
		vscode.postMessage({
			type: 'update',
			json: state.document
		});
	}

	function setEditMode(/** @type {boolean} */ enabled, /** @type {boolean} */ saveState = true) {
		state.editMode = enabled;
		if (state.editMode) editButton.classList.add('toggled');
		else editButton.classList.remove('toggled');
		let userInputs = document.querySelectorAll('.user-input');
		for (let i = 0; i < userInputs.length; i++) {
			if (userInputs[i].tagName == 'INPUT' || userInputs[i].tagName == 'SELECT') // @ts-ignore
				userInputs[i].disabled = !state.editMode;
			else if (userInputs[i].tagName == 'BUTTON') {
				if (state.editMode) // @ts-ignore
					userInputs[i].classList.remove("invisible"); // @ts-ignore
				else userInputs[i].classList.add("invisible");
			}
			else {
				if (state.editMode) // @ts-ignore
					userInputs[i].classList.remove("invisible"); // @ts-ignore
				else userInputs[i].classList.add("invisible");
			}
		}
		if (saveState) vscode.setState(state);
	}

	function getFileName(/** @type {string} */ str, canBeEmpty = true) {
		if (canBeEmpty) {
			return str.split('\\').pop().split('/').pop() || "";
		}
		let title = str.split('\\').pop().split('/').pop() || "";
		if (title) return title;
		else return "Untitled";
	};

	function fileSelected(/** @type {HTMLElement} */ item) {
		let idNum = item.id.split("_")[1];
		if (state.activeItemNumber !== idNum) {
			let activeItem = document.getElementById(`csv_${state.activeItemNumber}`);
			if (activeItem) { // During search, the currently selected item may not be visible
				activeItem.classList.remove("active");
			}
			state.activeItemNumber = idNum;
			item.classList.add("active");
			setEditMode(false);
		}
	}

	function removeOptions(/** @type {HTMLSelectElement} */ selectElement) {
		for (let i = selectElement.options.length - 1; i >= 0; i--) {
			selectElement.remove(i);
		}
	}

	function toggleQuoteCharWarn(/** @type {boolean} */ show) {
		if (show) {
			quotechar.classList.add('warn-input');
			errorLabelQuoteChar.classList.remove('invisible');
		} else {
			quotechar.classList.remove('warn-input');
			errorLabelQuoteChar.classList.add('invisible');
		}
	}

	function toggleDelimiterWarn(/** @type {boolean} */ show) {
		if (show) {
			delimiter.classList.add('warn-input');
			errorLabelDelimiter.classList.remove('invisible');
		} else {
			delimiter.classList.remove('warn-input');
			errorLabelDelimiter.classList.add('invisible');
		}
	}

	function validateInput(/** @type {HTMLInputElement} */ input, /** @type {string} */ regex) {
		inputIsValid = RegExp(regex, 'g').test(input.value);
		if (inputIsValid) input.classList.remove('error-input');
		else input.classList.add('error-input');
		return inputIsValid;
	}

	function isColumnUnique(/** @type {HTMLInputElement} */ input, /** @type {Number} */ columnId) {
		columnIsUnique = true;
		for (let i = 0; i < state.document[state.activeItemNumber].keys.length; i++) {
			if (columnId !== i && state.document[state.activeItemNumber].keys[i].column === input.value) columnIsUnique = false;
		}
		if (columnIsUnique) input.classList.remove('error-input');
		else input.classList.add('error-input');
		return columnIsUnique;
	}

	function isColumnValueUnique(/** @type {HTMLInputElement} */ input, /** @type {Number} */ columnId, /** @type {Number} */ valueId) {
		valueIsUnique = true;
		for (let i = 0; i < state.document[state.activeItemNumber].keys[columnId].values.length; i++) {
			if (valueId !== i && state.document[state.activeItemNumber].keys[columnId].values[i] === input.value) valueIsUnique = false;
		}
		if (valueIsUnique) input.classList.remove('error-input');
		else input.classList.add('error-input');
		return valueIsUnique;
	}

	function renderMainPanel() {
		let inputState = '';
		let buttonClass = '';
		if (!state.editMode) {
			inputState = 'disabled';
			buttonClass = 'invisible';
		}
		table.value = state.document[state.activeItemNumber].table;
		validateInput(table, tableRegex);
		schema.value = state.document[state.activeItemNumber].schema;
		validateInput(schema, schemaRegex);
		filepath.value = state.document[state.activeItemNumber].file;
		validateInput(filepath, filepathRegex);
		header.checked = state.document[state.activeItemNumber].header;
		headerNames.checked = state.document[state.activeItemNumber].useHeaderNames;
		distinguishEmptyFromNull.checked = state.document[state.activeItemNumber].distinguishEmptyFromNull;
		removeOptions(delimiter);
		for (let i = 0; i < delimiterList.length; i++) {
			let opt = document.createElement('option');
			opt.value = delimiterList[i];
			opt.innerHTML = delimiterList[i];
			if (delimiterList[i] === state.document[state.activeItemNumber].delimField) {
				opt.selected = true;
			}
			delimiter.appendChild(opt);
		}
		if (delimiterList.includes(state.document[state.activeItemNumber].delimField)) {
			toggleDelimiterWarn(false);
		} else {
			let opt = document.createElement('option');
			opt.value = state.document[state.activeItemNumber].delimField;
			opt.innerHTML = state.document[state.activeItemNumber].delimField;
			opt.selected = true;
			delimiter.appendChild(opt);
			toggleDelimiterWarn(true);
		}
		removeOptions(quotechar);
		for (let i = 0; i < quoteCharList.length; i++) {
			let opt = document.createElement('option');
			opt.value = quoteCharList[i];
			opt.innerHTML = quoteCharList[i];
			if (quoteCharList[i] === state.document[state.activeItemNumber].delimEnclosing) {
				opt.selected = true;
			}
			quotechar.appendChild(opt);
		}
		if (quoteCharList.includes(state.document[state.activeItemNumber].delimEnclosing)) {
			toggleQuoteCharWarn(false);
		} else {
			let opt = document.createElement('option');
			opt.value = state.document[state.activeItemNumber].delimEnclosing;
			opt.innerHTML = state.document[state.activeItemNumber].delimEnclosing;
			opt.selected = true;
			quotechar.appendChild(opt);
			toggleQuoteCharWarn(true);
		}
		let tableInnerHtml = '';
		for (let i = 0; i < state.document[state.activeItemNumber].keys.length; i++) {
			let columnValues = '<td class="column-values">';
			for (let cv = 0; cv < state.document[state.activeItemNumber].keys[i].values.length; cv++) {
				columnValues += `<div class="input-cell">
						<input class="user-input" type="text" id="kcv-${i}-${cv}" value="${state.document[state.activeItemNumber].keys[i].values[cv]}" ${inputState}>
						<button type="button" title="Delete" id="bkcv-${i}-${cv}" class="user-input ${buttonClass}"><i id="bkcv-${i}-${cv}-i" class="codicon codicon-trash"></i></button>
					</div>`;
			}
			columnValues += `<button type="button" class="icon-with-text user-input ${buttonClass}" id="addValue-${i}" title="Add Value"><i id="addValue-${i}-i" class="codicon codicon-add"></i>Add Value</button></td>`;
			let tableRow = `<tr><td><div class="input-cell">
					<input class="user-input" type="text" id="kc-${i}" value="${state.document[state.activeItemNumber].keys[i].column}" ${inputState}>
					<button type="button" title="Delete" id="bkc-${i}" class="user-input ${buttonClass}"><i id="bkc-${i}-i" class="codicon codicon-trash"></i></button>
				</div></td>${columnValues}</tr>`;
			tableInnerHtml += tableRow;
		}
		keys.innerHTML = tableInnerHtml;
	}

	/**
	 * Render the document in the webview.
	 */
	function showContent() {
		let items = '';
		if (searchMatches.length > 0) {
			for (let i = 0; i < searchMatches.length; i++) {
				items += `<div id="csv_${searchMatches[i]}" class="list-item ${searchMatches[i] == state.activeItemNumber ? 'active' : ''}"><i class="codicon codicon-file"></i>${getFileName(state.document[searchMatches[i]].file, false)}</div>`;
			}
		} else {
			for (let i = 0; i < state.document.length; i++) {
				items += `<div id="csv_${i}" class="list-item ${i == state.activeItemNumber ? 'active' : ''}"><i class="codicon codicon-file"></i>${getFileName(state.document[i].file, false)}</div>`;
			}
		}
		itemList.innerHTML = items;
		if (state.document.length > 0) {
			openButton.classList.remove("invisible");
			editButton.classList.remove("invisible");
			deleteButton.classList.remove("invisible");
			renderMainPanel();
			mainPanel.classList.remove('invisible');
			emptyFileContiner.classList.add('invisible');
		} else {
			openButton.classList.add("invisible");
			editButton.classList.add("invisible");
			deleteButton.classList.add("invisible");
			mainPanel.classList.add('invisible');
			emptyFileContiner.classList.remove('invisible');
		}
	}

	function updateContent() {
		if (!state.document) {
			state.document = [];
		}
		showContent();
	}

	// Handle messages sent from the extension to the webview
	window.addEventListener('message', event => {
		const message = event.data; // The json data that the extension sent
		switch (message.type) {
			case 'update':
				if (JSON.stringify(state.document, null, 2) === message.text) { // Fastest compare method I found...
					// Persist state information.
					// This state is returned in the call to `vscode.getState`, when a webview is reloaded.
					// We save the state despite, the new contnet being the same because in the case of
					// user inputs, we update the state object but we do not set the state in the VSCcode API
					// We decided to place it here as it will keep the state updated no matter the input.
					vscode.setState(state);
				} else {
					// Persist new state information.
					// This state is returned in the call to `vscode.getState`, when a webview is reloaded.
					if (message.text === '') {
						state.document = [];
					} else {
						try {
							state.document = JSON.parse(message.text);
						} catch {
							state.document = [];
							sendError('Error while trying to read the file. Treating it as an empty document.');
						}
					}

					vscode.setState(state);

					// Update our webview's content
					updateContent();
				}

				return;
			case 'saved':
				if (!inputIsValid) {
					sendError('File contains errors. There is an invalid input. Saved last known good edit.');
				} else if (!columnIsUnique) {
					sendError('File contains errors. Column names must be unique. Saved last known good edit.');
				} else if (!valueIsUnique) {
					sendError('File contains errors. Value names must be unique within a column. Saved last known good edit.');
				}
				return;
			case 'csv-error':
				filepath.classList.add('error-input');
				return;
		}
	});

	search.addEventListener('input', (event) => {
		searchMatches = [];
		if (search.value.length > 0) {
			for (let i = 0; i < state.document.length; i++) {
				if (state.document[i].file.includes(search.value)) searchMatches.push(i);
			}
		}
		showContent();
	});

	table.addEventListener('input', (event) => {
		if (validateInput(table, tableRegex) && state.document[state.activeItemNumber].table !== table.value) { // Yes, validation needs to be first
			state.document[state.activeItemNumber].table = table.value;
			updateDocument();
		}
	});

	schema.addEventListener('input', (event) => {
		if (validateInput(schema, schemaRegex) && state.document[state.activeItemNumber].schema !== schema.value) {
			state.document[state.activeItemNumber].schema = schema.value;
			updateDocument();
		}
	});

	filepath.addEventListener('input', (event) => {
		if (validateInput(filepath, filepathRegex) && state.document[state.activeItemNumber].file !== filepath.value) {
			state.document[state.activeItemNumber].file = filepath.value;
			updateDocument();
		}
	});

	quotechar.addEventListener('change', (event) => {
		// @ts-ignore
		if (quoteCharList.includes(event.target.value)) toggleQuoteCharWarn(false);
		else toggleQuoteCharWarn(true);
		state.document[state.activeItemNumber].delimEnclosing = quotechar.value;
		updateDocument();
	});

	delimiter.addEventListener('change', (event) => {
		// @ts-ignore
		if (delimiterList.includes(event.target.value)) toggleDelimiterWarn(false);
		else toggleDelimiterWarn(true);
		state.document[state.activeItemNumber].delimField = delimiter.value;
		updateDocument();
	});

	document.addEventListener('input', event => { // Every dynamically created input
		let node = event && event.target;
		// @ts-ignore
		if (node.id && node.id.startsWith('kcv-')) {
			// @ts-ignore
			let cvIdList = node.id.replace('kcv-', '').split('-');
			// Validation MUST be first and uniqueness last
			if ( // @ts-ignore
				validateInput(node, keysRegex) && // @ts-ignore
				state.document[state.activeItemNumber].keys[cvIdList[0]].values[cvIdList[1]] !== node.value && // @ts-ignore
				isColumnValueUnique(node, parseInt(cvIdList[0]), parseInt(cvIdList[1]))
			) {
				// @ts-ignore
				state.document[state.activeItemNumber].keys[cvIdList[0]].values[cvIdList[1]] = node.value;
				updateDocument();
			} // @ts-ignore
		} else if (node.id && node.id.startsWith('kc-')) {
			// @ts-ignore
			let columnId = parseInt(node.id.replace('kc-', ''));
			// @ts-ignore
			if (validateInput(node, keysRegex) && state.document[state.activeItemNumber].keys[columnId] !== node.value && isColumnUnique(node, columnId)) {
				// @ts-ignore
				state.document[state.activeItemNumber].keys[columnId].column = node.value;
				updateDocument();
			}
		}
	}, true);

	document.addEventListener('click', event => {
		let node = event && event.target;
		if ("id" in node) {
			// @ts-ignore
			if (node.id === 'addCsv') {
				searchMatches = [];
				search.value = '';
				state.document.push({
					"table": "",
					"schema": "",
					"file": "",
					"header": false,
					"useHeaderNames": false,
					"delimField": ";",
					"delimEnclosing": "\"",
					"distinguishEmptyFromNull": true,
					"keys": []
				});
				updateContent();
				updateDocument();
			}
			// @ts-ignore
			else if (node.id.startsWith(openButton.id)) {
				vscode.postMessage({
					type: "open",
					text: filepath.value
				});
			}
			// @ts-ignore
			else if (node.id.startsWith(editButton.id)) {
				setEditMode(!state.editMode);
			}
			// @ts-ignore
			else if (node.id.startsWith(deleteButton.id)) {
				state.document.splice(state.activeItemNumber, 1);
				if (state.document.length === 0) state.activeItemNumber = 0;
				else if (state.activeItemNumber >= state.document.length) {
					state.activeItemNumber = state.document.length - 1;
				}
				updateContent();
				updateDocument();
			}
			// @ts-ignore
			else if (node.id.startsWith('csv_')) {
				// @ts-ignore
				fileSelected(node);
				renderMainPanel();
			}
			// @ts-ignore
			else if (node.id.startsWith('bkcv-')) {
				// @ts-ignore
				let cvIdList = node.id.replace('bkcv-', '').replace('-i', '').split('-');
				state.document[state.activeItemNumber].keys[cvIdList[0]].values.splice(cvIdList[1], 1);
				renderMainPanel();
				updateDocument();
			}
			// @ts-ignore
			else if (node.id.startsWith('bkc-')) {
				// @ts-ignore
				let columnId = parseInt(node.id.replace('bkc-', '').replace('-i', ''));
				state.document[state.activeItemNumber].keys.splice(columnId, 1);
				renderMainPanel();
				updateDocument();
			}
			// @ts-ignore
			else if (node.id.startsWith('addValue-')) {
				// @ts-ignore
				let column = node.id.replace('addValue-', '').replace('-i', '');
				let num = 1;
				let values = state.document[state.activeItemNumber].keys[column].values;
				values.sort();
				for (let i = 0; i < values.length; i++) {
					if (values[i] === `NEW_ENTRY_${num}`) num++;
				}
				state.document[state.activeItemNumber].keys[column].values.push(`NEW_ENTRY_${num}`);
				renderMainPanel();
				updateDocument();
			}
			// @ts-ignore
			else if (node.id.startsWith('addColumn')) {
				let num = 1;
				let columns = state.document[state.activeItemNumber].keys;
				columns.sort(compareKeys);
				for (let i = 0; i < columns.length; i++) {
					if (columns[i].column === `NEW_ENTRY_${num}`) num++;
				}
				state.document[state.activeItemNumber].keys.push(
					{
						"column": `NEW_ENTRY_${num}`,
						"values": []
					}
				);
				renderMainPanel();
				updateDocument();
			}
		}
	}, true);
}())