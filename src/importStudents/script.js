// CSV-Import von Schüler*innen: Datei lesen, jede Zeile prüfen, Vorschau
// zeigen und erst auf Knopfdruck an /import_students schicken.

let courseIdsByName = {};   // "robotik" -> "202"
let genders = [];
let existingNames = new Set();
let rows = [];              // geprüfte Zeilen der zuletzt gewählten Datei

// Spaltennamen, die wir verstehen (klein, ohne Umlaute und Sonderzeichen).
const COLUMN_ALIASES = {
	firstName: ["vorname", "firstname", "first"],
	lastName: ["nachname", "lastname", "familienname", "surname", "last"],
	birthday: ["geburtstag", "geburtsdatum", "birthday", "geboren"],
	gender: ["geschlecht", "gender"],
	street: ["strasse", "str", "street"],
	nr: ["nr", "hausnummer", "hausnr", "hnr", "nummer"],
	zip: ["plz", "postleitzahl", "zip"],
	city: ["stadt", "ort", "wohnort", "city"],
	country: ["land", "country"],
	courses: ["kurs", "kurse", "course", "courses"],
};

// Übliche Schreibweisen aus Schullisten -> Gender-Enum des Backends.
const GENDER_ALIASES = {
	m: "MALE", maennlich: "MALE", mann: "MALE", junge: "MALE", male: "MALE",
	w: "FEMALE", f: "FEMALE", weiblich: "FEMALE", frau: "FEMALE", maedchen: "FEMALE", female: "FEMALE",
	d: "NON_BINARY", divers: "NON_BINARY", nichtbinaer: "NON_BINARY", nonbinary: "NON_BINARY",
};

function normalize(text) {
	return String(text).trim().toLowerCase()
		.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
		.replace(/[^a-z0-9]/g, "");
}

async function load() {
	document.getElementById("file").addEventListener("change", onFile);
	document.getElementById("import").addEventListener("click", runImport);
	document.getElementById("with-card").addEventListener("change", updateActions);

	const [coursesRes, gendersRes, namesRes] = await Promise.all([
		fetch("/courses", { method: "POST" }),
		fetch("/genders", { method: "POST" }),
		fetch("/student_names", { method: "POST" }),
	]);
	const courses = coursesRes.ok ? (await coursesRes.json())["courses"] || {} : {};
	Object.keys(courses).forEach(id => { courseIdsByName[normalize(courses[id]["name"])] = id; });
	genders = gendersRes.ok ? await gendersRes.json() : [];
	const names = namesRes.ok ? await namesRes.json() : [];
	names.forEach(n => existingNames.add(personKey(n.firstName, n.lastName)));
}

function personKey(first, last) {
	return normalize(first) + "|" + normalize(last);
}

// ---------- Datei lesen ----------

async function onFile(event) {
	const file = event.target.files[0];
	document.getElementById("message").innerText = "";
	if (!file) return;
	document.getElementById("file-name").innerText = file.name;

	const buffer = await file.arrayBuffer();
	let text;
	try {
		text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
	} catch (e) {
		// Excel speichert CSV unter Windows oft nicht als UTF-8 - ohne diesen
		// Rückfall würden aus Umlauten Fragezeichen.
		text = new TextDecoder("windows-1252").decode(buffer);
	}
	text = text.replace(/^﻿/, "");

	const table = parseCsv(text, detectDelimiter(text));
	if (table.length < 2) {
		showError("Die Datei enthält keine Datenzeilen.");
		return;
	}
	const columns = mapColumns(table[0]);
	const missing = ["firstName", "lastName", "gender"].filter(c => columns[c] === undefined);
	if (missing.length) {
		const labels = { firstName: "Vorname", lastName: "Nachname", gender: "Geschlecht" };
		showError("Diese Spalten fehlen: " + missing.map(c => labels[c]).join(", ")
			+ ". Gefunden wurden: " + table[0].join(", "));
		return;
	}

	const seen = new Set();
	rows = table.slice(1)
		.map((cells, i) => ({ cells, line: i + 2 }))
		.filter(r => r.cells.some(c => c.trim() !== ""))
		.map(r => checkRow(r.cells, r.line, columns, seen));
	render();
}

function detectDelimiter(text) {
	const header = text.split(/\r?\n/)[0];
	const counts = [";", ",", "\t"].map(d => [d, header.split(d).length]);
	counts.sort((a, b) => b[1] - a[1]);
	return counts[0][0];
}

// Kleiner CSV-Parser: Anführungszeichen, "" als Escape und Zeilenumbrüche in
// Feldern werden unterstützt.
function parseCsv(text, delimiter) {
	const result = [];
	let row = [], field = "", quoted = false;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (quoted) {
			if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
			else if (ch === '"') quoted = false;
			else field += ch;
		} else if (ch === '"') {
			quoted = true;
		} else if (ch === delimiter) {
			row.push(field); field = "";
		} else if (ch === "\n" || ch === "\r") {
			if (ch === "\r" && text[i + 1] === "\n") i++;
			row.push(field); result.push(row);
			row = []; field = "";
		} else {
			field += ch;
		}
	}
	if (field !== "" || row.length) { row.push(field); result.push(row); }
	return result;
}

function mapColumns(header) {
	const columns = {};
	header.forEach((name, index) => {
		const key = normalize(name);
		for (const [column, aliases] of Object.entries(COLUMN_ALIASES)) {
			if (aliases.includes(key) && columns[column] === undefined) columns[column] = index;
		}
	});
	return columns;
}

// ---------- Zeilen prüfen ----------

function checkRow(cells, line, columns, seen) {
	const get = (column) => columns[column] === undefined ? "" : (cells[columns[column]] || "").trim();
	const row = {
		line,
		firstName: get("firstName"),
		lastName: get("lastName"),
		birthdayText: get("birthday"),
		genderText: get("gender"),
		street: get("street"),
		nrText: get("nr"),
		zipText: get("zip"),
		city: get("city"),
		country: get("country") || "Deutschland",
		coursesText: get("courses"),
		problem: null,
		duplicate: false,
	};

	if (!row.firstName || !row.lastName) {
		row.problem = "Vor- oder Nachname fehlt";
		return row;
	}

	row.gender = parseGender(row.genderText);
	if (!row.gender) {
		row.problem = row.genderText ? `Geschlecht „${row.genderText}“ unbekannt` : "Geschlecht fehlt";
		return row;
	}

	row.birthday = row.birthdayText ? parseDate(row.birthdayText) : 0;
	if (row.birthday === null) {
		row.problem = `Geburtstag „${row.birthdayText}“ ungültig`;
		return row;
	}

	row.nr = parseInt(row.nrText) || 0;
	row.zip = parseInt(row.zipText) || 0;

	row.kurse = [];
	const courseNames = row.coursesText.split(/[|/,]/).map(s => s.trim()).filter(Boolean);
	for (const name of courseNames) {
		const id = courseIdsByName[normalize(name)];
		if (!id) {
			row.problem = `Kurs „${name}“ gibt es nicht`;
			return row;
		}
		row.kurse.push(parseInt(id));
	}

	// Doppelte würden sonst still ein zweites Mal angelegt - etwa wenn
	// dieselbe Datei aus Versehen zweimal importiert wird.
	const key = personKey(row.firstName, row.lastName);
	if (existingNames.has(key) || seen.has(key)) {
		row.duplicate = true;
		row.problem = existingNames.has(key) ? "gibt es schon" : "steht doppelt in der Datei";
	}
	seen.add(key);
	return row;
}

function parseGender(text) {
	if (!text) return null;
	const alias = GENDER_ALIASES[normalize(text)];
	if (alias) return alias;
	const upper = text.trim().toUpperCase().replace(/[\s-]+/g, "_");
	return genders.includes(upper) ? upper : null;
}

// TT.MM.JJJJ (auch TT.MM.JJ) oder JJJJ-MM-TT -> Millisekunden (UTC-Mitternacht,
// wie beim Anlegen einzelner Nutzer).
function parseDate(text) {
	let d, m, y;
	let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
	if (match) {
		[y, m, d] = [match[1], match[2], match[3]].map(Number);
	} else if ((match = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/))) {
		[d, m, y] = [match[1], match[2], match[3]].map(Number);
		if (y < 100) y += (y <= new Date().getFullYear() % 100) ? 2000 : 1900;
	} else {
		return null;
	}
	const ms = Date.UTC(y, m - 1, d);
	const check = new Date(ms);
	if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
	return ms;
}

// ---------- Anzeige ----------

function render() {
	const body = document.querySelector("#preview tbody");
	body.innerHTML = "";
	rows.forEach(row => {
		const tr = document.createElement("tr");
		const address = [row.street, row.nrText].filter(Boolean).join(" ")
			+ (row.zipText || row.city ? ", " + [row.zipText, row.city].filter(Boolean).join(" ") : "");
		[
			row.line,
			row.firstName,
			row.lastName,
			row.birthday ? formatDate(row.birthday) : (row.birthdayText || "–"),
			row.gender || row.genderText || "–",
			address.trim() || "–",
			row.coursesText || "–",
		].forEach(value => {
			const td = document.createElement("td");
			td.textContent = value;
			tr.appendChild(td);
		});
		const statusTd = document.createElement("td");
		statusTd.appendChild(statusChip(row));
		tr.appendChild(statusTd);
		row.statusCell = statusTd;
		body.appendChild(tr);
	});

	document.getElementById("preview-wrap").classList.remove("hidden");
	updateActions();
}

function statusChip(row) {
	const chip = document.createElement("span");
	if (row.result) {
		chip.className = "chip " + (row.result.status === "error" ? "chip-error" : "chip-ok");
		chip.textContent = { queued: "vorgemerkt", created: "angelegt" }[row.result.status]
			|| ("Fehler: " + (row.result.message || "unbekannt"));
		return chip;
	}
	if (!row.problem) {
		chip.className = "chip chip-ready";
		chip.textContent = "bereit";
	} else {
		chip.className = "chip " + (row.duplicate ? "chip-warn" : "chip-error");
		chip.textContent = row.problem;
	}
	return chip;
}

function formatDate(ms) {
	const d = new Date(ms);
	return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
}

function importable() {
	return rows.filter(r => !r.problem && !r.result);
}

function updateActions() {
	const ready = importable().length;
	const skipped = rows.filter(r => r.problem).length;
	const summary = document.getElementById("summary");
	summary.classList.remove("hidden");
	summary.textContent = `${rows.length} Zeilen gelesen, ${ready} bereit`
		+ (skipped ? `, ${skipped} werden übersprungen (siehe Status).` : ".");

	const withCard = document.getElementById("with-card").checked;
	document.getElementById("card-hint").classList.toggle("hidden", !withCard);
	document.getElementById("actions").classList.toggle("hidden", ready === 0);
	document.getElementById("import").textContent = ready === 1
		? "1 Person importieren"
		: `${ready} Personen importieren`;
}

function showError(text) {
	rows = [];
	document.getElementById("preview-wrap").classList.add("hidden");
	document.getElementById("actions").classList.add("hidden");
	document.getElementById("summary").classList.add("hidden");
	document.getElementById("message").innerText = text;
}

// ---------- Import ----------

function confirmNoCard() {
	return new Promise((resolve) => {
		const overlay = document.getElementById("confirm-overlay");
		const ok = document.getElementById("confirm-ok");
		const cancel = document.getElementById("confirm-cancel");

		function close(answer) {
			overlay.classList.add("hidden");
			ok.removeEventListener("click", onOk);
			cancel.removeEventListener("click", onCancel);
			overlay.removeEventListener("click", onBackdrop);
			document.removeEventListener("keydown", onKey);
			resolve(answer);
		}
		function onOk() { close(true); }
		function onCancel() { close(false); }
		function onBackdrop(e) { if (e.target === overlay) close(false); }
		function onKey(e) { if (e.key === "Escape") close(false); }

		ok.addEventListener("click", onOk);
		cancel.addEventListener("click", onCancel);
		overlay.addEventListener("click", onBackdrop);
		document.addEventListener("keydown", onKey);

		overlay.classList.remove("hidden");
		cancel.focus();
	});
}

async function runImport() {
	const withCard = document.getElementById("with-card").checked;
	const todo = importable();
	if (!todo.length) return;
	if (!withCard && !(await confirmNoCard())) return;

	const button = document.getElementById("import");
	button.disabled = true;
	document.getElementById("message").innerText = "Importiere…";

	let results;
	try {
		const res = await fetch("/import_students", {
			method: "POST",
			headers: { "content-type": "application/json; charset=UTF-8" },
			body: JSON.stringify({
				withCard,
				rows: todo.map(r => ({
					firstName: r.firstName,
					lastName: r.lastName,
					gender: r.gender,
					birthday: r.birthday,
					address: { nr: r.nr, street: r.street, city: r.city, zip: r.zip, country: r.country },
					kurse: r.kurse,
				})),
			}),
		});
		if (!res.ok) throw new Error("HTTP " + res.status);
		results = (await res.json())["results"];
	} catch (err) {
		console.error("Import fehlgeschlagen:", err);
		document.getElementById("message").innerText = "Import fehlgeschlagen - es wurde niemand angelegt.";
		button.disabled = false;
		return;
	}

	todo.forEach((row, i) => {
		row.result = results[i] || { status: "error", message: "keine Antwort" };
		if (row.result.status !== "error") existingNames.add(personKey(row.firstName, row.lastName));
		row.statusCell.innerHTML = "";
		row.statusCell.appendChild(statusChip(row));
	});

	const ok = todo.filter(r => r.result.status !== "error").length;
	const failed = todo.length - ok;
	let text = withCard
		? `${ok} vorgemerkt. Jetzt am Automaten „Nutzer hinzufügen“ öffnen und die Karten in der Reihenfolge der Liste scannen.`
		: `${ok} angelegt.`;
	if (failed) text += ` ${failed} konnten nicht angelegt werden (siehe Status).`;
	document.getElementById("message").innerText = text;
	button.disabled = false;
	updateActions();
}
