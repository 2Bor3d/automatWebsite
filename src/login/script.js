function login() {
	const msg = document.getElementById("login-msg");
	msg.innerText = "";
	fetch("login", {
		method: "POST",
		body: JSON.stringify({
			username: document.getElementById("user").value,
			password: document.getElementById("pwd").value,
		}),
		headers: {
			"Content-type": "application/json; charset=UTF-8",
		}
	}).then((response) => {
		if (response.ok) {
			window.location.reload();
		} else if (response.status === 401) {
			msg.innerText = "E-Mail-Adresse oder Passwort falsch.";
		} else {
			msg.innerText = "Anmelden gerade nicht möglich - läuft der Automat?";
		}
	}).catch(() => {
		msg.innerText = "Die Website ist nicht erreichbar.";
	});
}

function pressed(event, button) {
	if (event.keyCode === 13) {
		if (button === "user") {
			document.getElementById("pwd").focus();
		}
		if (button === "pwd") {
			login();
		}
	}
}

// Gibt es noch gar keinen Zugang, zeigt die Seite statt der Anmeldung das
// Formular für den ersten Admin.
function checkSetup() {
	fetch("setup_status").then((response) => {
		if (!response.ok) throw new Error("HTTP " + response.status);
		return response.json();
	}).then((status) => {
		if (!status.needsSetup) return;
		const select = document.getElementById("s-gender");
		status.genders.forEach((gender) => {
			const option = document.createElement("option");
			option.value = gender;
			option.text = gender;
			select.appendChild(option);
		});
		document.getElementById("login").classList.add("hidden");
		document.getElementById("setup").classList.remove("hidden");
		document.getElementById("setup").addEventListener("submit", createAdmin);
		document.getElementById("s-first").focus();
	}).catch(() => {
		// Ohne Antwort bleibt einfach die normale Anmeldung stehen.
	});
}

function createAdmin(event) {
	event.preventDefault();
	const msg = document.getElementById("setup-msg");
	const value = (id) => document.getElementById(id).value;
	const pw1 = value("s-pw1");

	let problem = "";
	if (!value("s-first").trim() || !value("s-last").trim()) problem = "Bitte Vor- und Nachnamen eingeben.";
	else if (!value("s-gender")) problem = "Bitte ein Geschlecht auswählen.";
	else if (!value("s-mail").includes("@")) problem = "Bitte eine gültige E-Mail-Adresse eingeben.";
	else if (pw1.length < 8) problem = "Das Passwort muss mindestens 8 Zeichen haben.";
	else if (pw1 !== value("s-pw2")) problem = "Die Passwörter sind nicht gleich.";
	if (problem) {
		msg.innerText = problem;
		return;
	}

	const button = document.getElementById("s-submit");
	button.disabled = true;
	msg.innerText = "";
	fetch("setup_admin", {
		method: "POST",
		body: JSON.stringify({
			firstName: value("s-first"),
			lastName: value("s-last"),
			gender: value("s-gender"),
			email: value("s-mail"),
			password: pw1,
		}),
		headers: { "Content-type": "application/json; charset=UTF-8" },
	}).then(async (response) => {
		if (response.ok) {
			// Angelegt und gleich angemeldet.
			window.location.reload();
			return;
		}
		const text = await response.text();
		if (response.status === 409) {
			// Jemand anderes war schneller - dann ganz normal anmelden.
			document.getElementById("setup").classList.add("hidden");
			document.getElementById("login").classList.remove("hidden");
			document.getElementById("login-msg").innerText = text;
			return;
		}
		msg.innerText = text || "Der Zugang konnte nicht angelegt werden.";
		button.disabled = false;
	}).catch(() => {
		msg.innerText = "Die Website ist nicht erreichbar.";
		button.disabled = false;
	});
}
