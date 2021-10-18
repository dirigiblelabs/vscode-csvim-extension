// @ts-check

(function () {
	// @ts-ignore
	const vscode = acquireVsCodeApi();

	const delimiterList = [',', '\\t', '|', ';', '#'];
	const quoteCharList = ["'", "\"", "#"];
	const tableRegex = '^[A-Za-z0-9_\\-$.]+$';
	const schemaRegex = '^[A-Za-z0-9_\\-$.]+$';
	const filepathRegex = '^[\\w\\-. /$]+$';
	const keysRegex = '^[A-Za-z0-9_\\-$.]+$';

	const emptyFileContiner = /** @type {HTMLElement} */ (document.querySelector('.no-files-panel'));
	const mainPanel = /** @type {HTMLElement} */ (document.querySelector('.main-panel'));
	const itemList = /** @type {HTMLElement} */ (document.querySelector('.item-list'));

	const editButton = /** @type {HTMLButtonElement} */ (document.getElementById('editToggle'));

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

	function fileSelected(/** @type {string} */ id) {
		let idNum = id.split("_")[1];
		if (state.activeItemNumber !== idNum) {
			state.editMode = false;
			document.getElementById(`csv_${state.activeItemNumber}`).classList.remove("active");
			state.activeItemNumber = idNum;
			document.getElementById(id).classList.add("active");
			vscode.setState(state);
		}
	}

	function removeOptions(/** @type {HTMLSelectElement} */ selectElement) {
		for (let i = selectElement.options.length - 1; i >= 0; i--) {
			selectElement.remove(i);
		}
	}

	function toggleQuoteCharError(/** @type {boolean} */ show) {
		if (show) {
			quotechar.classList.add('error-input');
			errorLabelQuoteChar.classList.remove('invisible');
		} else {
			quotechar.classList.remove('error-input');
			errorLabelQuoteChar.classList.add('invisible');
		}
	}

	function toggleDelimiterError(/** @type {boolean} */ show) {
		if (show) {
			delimiter.classList.add('error-input');
			errorLabelDelimiter.classList.remove('invisible');
		} else {
			delimiter.classList.remove('error-input');
			errorLabelDelimiter.classList.add('invisible');
		}
	}

	function validateInput(/** @type {HTMLInputElement} */ input, /** @type {string} */ regex) {
		let correct = RegExp(regex, 'g').test(input.value);
		if (correct) {
			input.classList.remove('error-input');
		} else {
			input.classList.add('error-input');
		}
		return correct;
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
			toggleDelimiterError(false);
		} else {
			let opt = document.createElement('option');
			opt.value = state.document[state.activeItemNumber].delimField;
			opt.innerHTML = state.document[state.activeItemNumber].delimField;
			opt.selected = true;
			delimiter.appendChild(opt);
			toggleDelimiterError(true);
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
			toggleQuoteCharError(false);
		} else {
			let opt = document.createElement('option');
			opt.value = state.document[state.activeItemNumber].delimEnclosing;
			opt.innerHTML = state.document[state.activeItemNumber].delimEnclosing;
			opt.selected = true;
			quotechar.appendChild(opt);
			toggleQuoteCharError(true);
		}
		let tableInnerHtml = '';
		for (let i = 0; i < state.document[state.activeItemNumber].keys.length; i++) {
			let columnValues = '<td class="column-values">';
			for (let cv = 0; cv < state.document[state.activeItemNumber].keys[i].values.length; cv++) {
				columnValues += `<div class="input-cell">
						<input class="user-input" type="text" value="${state.document[state.activeItemNumber].keys[i].values[cv]}" ${inputState}>
						<button type="button" title="Delete" class="user-input ${buttonClass}"><i class="codicon codicon-trash"></i></button>
					</div>`;
			}
			columnValues += `<button type="button" class="icon-with-text user-input ${buttonClass}" title="Add Value"><i class="codicon codicon-add"></i>Add Value</button></td>`;
			let tableRow = `<tr><td><div class="input-cell">
					<input class="user-input" type="text" value="${state.document[state.activeItemNumber].keys[i].column}" ${inputState}>
					<button type="button" title="Delete" class="user-input ${buttonClass}"><i class="codicon codicon-trash"></i></button>
				</div></td>${columnValues}</tr>`;
			tableInnerHtml += tableRow;
		}
		keys.innerHTML = tableInnerHtml;
	}

	/**
	 * Render the document in the webview.
	 */
	function showContent() {
		if (state.document.length > 0) {
			let items = '';
			for (let i = 0; i < state.document.length; i++) {
				items += `<div id="csv_${i}" class="list-item ${i == state.activeItemNumber ? 'active' : ''}"><i class="codicon codicon-file"></i>${getFileName(state.document[i].file)}</div>`;
			}
			itemList.innerHTML = items;
			renderMainPanel();
			mainPanel.classList.remove('invisible');
			emptyFileContiner.classList.add('invisible');
		} else {
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
		let json;
		switch (message.type) {
			case 'update':
				// Persist state information.
				// This state is returned in the call to `vscode.getSFtate` below when a webview is reloaded.
				state.document = message.json;
				vscode.setState(state);

				// Update our webview's content
				updateContent();

				return;
		}
	});

	table.addEventListener('input', (event) => {
		if (validateInput(table, tableRegex)) state.document[state.activeItemNumber].table = table.value;
		updateDocument();
	});

	schema.addEventListener('input', (event) => {
		if (validateInput(schema, schemaRegex)) state.document[state.activeItemNumber].schema = schema.value;
		updateDocument();
	});

	filepath.addEventListener('input', (event) => {
		if (validateInput(filepath, filepathRegex)) state.document[state.activeItemNumber].file = filepath.value;
		updateDocument();
	});

	quotechar.addEventListener('change', (event) => {
		// @ts-ignore
		if (quoteCharList.includes(event.target.value)) toggleQuoteCharError(false);
		else toggleQuoteCharError(true);
		state.document[state.activeItemNumber].delimEnclosing = quotechar.value;
	});

	delimiter.addEventListener('change', (event) => {
		// @ts-ignore
		if (delimiterList.includes(event.target.value)) toggleDelimiterError(false);
		else toggleDelimiterError(true);
		state.document[state.activeItemNumber].delimField = delimiter.value;
	});

	document.addEventListener('input', event => {
		let node = event && event.target;
		// @ts-ignore
		if (!node.id) { // Every dynamically created input
			// @ts-ignore
			validateInput(node, keysRegex);
		}
	}, true);

	document.addEventListener('click', event => {
		let node = event && event.target;
		if ("id" in node) {
			// @ts-ignore
			if (node.id === 'openCsv') {
				vscode.postMessage({
					type: "open",
					text: filepath.value
				});
			}
			// @ts-ignore
			else if (node.id === editButton.id) {
				setEditMode(!state.editMode);
			}
			// @ts-ignore
			else if (node.id.startsWith('csv_')) {
				// @ts-ignore
				fileSelected(node.id);
				renderMainPanel();
			}
		}
	}, true);
}())