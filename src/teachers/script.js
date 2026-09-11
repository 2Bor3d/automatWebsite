let _scannedRfid = null;

async function startRfidScan(btn) {
    _scannedRfid = null;
    const status = document.getElementById("rfid-scan-status");
    btn.disabled = true;
    btn.textContent = "Warte auf Karte...";
    status.textContent = "";

    await fetch("/start_scan", { method: "POST" });

    for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 500));
        const res = await fetch("/check_scan", { method: "POST" });
        const data = await res.json();
        if (data.status === "done") {
            _scannedRfid = data.rfid;
            btn.textContent = "Karte scannen";
            btn.disabled = false;
            status.textContent = "✓ " + data.rfid.join(", ");
            status.style.color = "green";
            return;
        }
    }

    btn.textContent = "Karte scannen";
    btn.disabled = false;
    status.textContent = "Timeout";
    status.style.color = "red";
}

async function send(address, dict) {
	const response = await fetch(address, {
		method: "POST",
		body: JSON.stringify(dict),
		headers: { "content-type": "application/json; charset=UTF-8" },
	});
	return await response.text();
}

let allTeachers = [];
let allGenders = [];

function closePopup() {
	document.getElementById("popup").classList.add("hidden");
	document.getElementById("message").textContent = "";
}

async function popup(id) {
	const teacher = allTeachers.find(t => t.id == id);
	if (!teacher) return;

	document.getElementById("popup").classList.remove("hidden");
	if (window.resetModalScroll) window.resetModalScroll();
	document.getElementById("identification").innerText = "Id: " + teacher.id;
	document.getElementById("firstName").value = teacher.firstName;
	document.getElementById("lastName").value = teacher.lastName;
	document.getElementById("mail").value = teacher.mail || "";
	document.getElementById("level").value = teacher.level || "NORMAL";
	document.getElementById("newPassword").value = "";
	document.getElementById("passwordHash").value = teacher.password || "";

	const genderSel = document.getElementById("gender");
	genderSel.innerHTML = "";
	allGenders.forEach(g => {
		const opt = document.createElement("option");
		opt.value = g; opt.text = g;
		if (g === teacher.gender) opt.selected = true;
		genderSel.appendChild(opt);
	});

	if (teacher.birthday) {
		// Das Backend liefert Mitternacht in deutscher Zeit (DATE-Spalte). In
		// UTC gelesen wäre das 22/23 Uhr am Vortag - also lokal auslesen.
		const bd = new Date(teacher.birthday);
		const yyyy = bd.getFullYear();
		const mm = String(bd.getMonth() + 1).padStart(2, "0");
		const dd = String(bd.getDate()).padStart(2, "0");
		document.getElementById("birthday").value = `${yyyy}-${mm}-${dd}`;
	} else {
		document.getElementById("birthday").value = "";
	}

	const w = teacher.wohnort || {};
	document.getElementById("addr-nr").value = w.nr || "";
	document.getElementById("addr-street").value = w.street || "";
	document.getElementById("addr-city").value = w.city || "";
	document.getElementById("addr-zip").value = w.zip || "";
	document.getElementById("addr-country").value = w.country || "";
	if (w.id) document.getElementById("addr-nr").dataset.wohnortId = w.id;

	document.getElementById("rfid-display").textContent = (teacher.rfid || []).join(", ");
	_scannedRfid = null;
	document.getElementById("rfid-scan-status").textContent = "";
	document.getElementById("rfid-scan-btn").textContent = "Karte scannen";
	document.getElementById("rfid-scan-btn").disabled = false;

	document.getElementById("save").setAttribute("onclick", `saveTeacher('${id}')`);
	document.getElementById("delete").setAttribute("onclick", `deleteTeacher('${id}')`);
}

async function saveTeacher(id) {
	const teacher = allTeachers.find(t => t.id == id);
	const birthdayVal = document.getElementById("birthday").value;
	const wohnort = {
		nr: parseInt(document.getElementById("addr-nr").value) || 0,
		street: document.getElementById("addr-street").value,
		city: document.getElementById("addr-city").value,
		zip: parseInt(document.getElementById("addr-zip").value) || 0,
		country: document.getElementById("addr-country").value,
	};
	const wohnortId = document.getElementById("addr-nr").dataset.wohnortId;
	if (wohnortId) wohnort.id = parseInt(wohnortId);

	const payload = {
		id: parseInt(id),
		firstName: document.getElementById("firstName").value,
		lastName: document.getElementById("lastName").value,
		mail: document.getElementById("mail").value,
		level: document.getElementById("level").value,
		gender: document.getElementById("gender").value,
		birthday: birthdayVal ? new Date(birthdayVal).getTime() : (teacher ? teacher.birthday : 0),
		wohnort: wohnort,
		rfid: _scannedRfid || (teacher ? (teacher.rfid || []) : []),
		passwordHash: document.getElementById("passwordHash").value,
		newPassword: document.getElementById("newPassword").value,
	};

	const result = await send("/change_teacher", payload);
	if (result === "success") {
		document.getElementById("message").textContent = "Gespeichert!";
		setTimeout(() => { closePopup(); load(); }, 800);
	} else {
		document.getElementById("message").textContent = "Fehler beim Speichern.";
	}
}

async function deleteTeacher(id) {
	if (!confirm("Lehrkraft wirklich löschen?\nAlle Daten werden restlos gelöscht.")) return;
	const result = await send("/delete_teacher", { id: parseInt(id) });
	if (result === "success") {
		closePopup();
		load();
	} else {
		document.getElementById("message").textContent = "Fehler beim Löschen.";
	}
}

async function load() {
	const [teachersRes, gendersRes] = await Promise.all([
		fetch("/get_users", { method: "POST" }),
		fetch("/genders", { method: "POST" }),
	]);
	allTeachers = await teachersRes.json();
	allGenders = await gendersRes.json();

	if (!Array.isArray(allTeachers)) {
		allTeachers = [];
		return;
	}

	const table = document.getElementById("table");
	table.querySelectorAll("tr:not(:first-child)").forEach(r => r.remove());

	allTeachers.forEach(teacher => {
		const tr = document.createElement("tr");
		tr.id = `teacher-${teacher.id}`;

		[teacher.firstName, teacher.lastName, teacher.mail || "", teacher.level || ""].forEach(text => {
			const td = document.createElement("td");
			td.textContent = text;
			tr.appendChild(td);
		});

		const td = document.createElement("td");
		const btn = document.createElement("button");
		btn.className = "edit-btn";
		btn.setAttribute("onclick", `popup(${teacher.id})`);
		btn.innerText = "editieren";
		td.appendChild(btn);
		tr.appendChild(td);
		table.appendChild(tr);
	});
}

// script.js wird im <head> geladen, also vor dem Rest des Bodys - deshalb
// erst ab DOMContentLoaded auf #popup etc. zugreifen.
document.addEventListener("DOMContentLoaded", function () {
	// Klick auf den abgedunkelten Hintergrund oder Esc schließt das Fenster.
	document.getElementById("popup").addEventListener("click", function (e) {
		if (e.target.id === "popup") closePopup();
	});
	document.addEventListener("keydown", function (e) {
		if (e.key === "Escape" && !document.getElementById("popup").classList.contains("hidden")) {
			closePopup();
		}
	});

	// Sprungleiste links: Klick scrollt zum Abschnitt, aktiver Abschnitt wird beim Scrollen markiert.
	const rail = document.querySelector(".modal-rail");
	const scroller = document.querySelector(".modal-scroll");
	if (!rail || !scroller) return;

	function setActive(id) {
		rail.querySelectorAll("button[data-jump]").forEach(function (b) {
			b.classList.toggle("active", b.dataset.jump === id);
		});
	}

	// Angeklickter Abschnitt, solange er noch (mindestens teilweise) sichtbar
	// ist - manche Abschnitte lassen sich wegen zu wenig Inhalt darunter nicht
	// bis ganz nach oben scrollen, sollen aber trotzdem als aktiv gelten.
	let clickedId = null;

	rail.addEventListener("click", function (e) {
		const btn = e.target.closest("button[data-jump]");
		if (!btn) return;
		const target = document.getElementById(btn.dataset.jump);
		if (target) {
			clickedId = btn.dataset.jump;
			setActive(clickedId);
			target.scrollIntoView({ block: "start", behavior: "smooth" });
		}
	});

	function isVisible(section) {
		const top = section.offsetTop - scroller.scrollTop;
		return top < scroller.clientHeight && top + section.offsetHeight > 0;
	}

	// Aktiver Abschnitt = der letzte, dessen oberer Rand bereits überscrollt wurde.
	// Funktioniert unabhängig davon, ob der Inhalt insgesamt viel oder wenig
	// größer als das Fenster ist (im Gegensatz zu einem IntersectionObserver mit
	// festem Schwellwert, der bei kurzem Inhalt mehrere Treffer gleichzeitig liefert).
	const sections = Array.from(scroller.querySelectorAll(".modal-section"));
	function updateActiveByScroll() {
		if (clickedId) {
			const clicked = document.getElementById(clickedId);
			if (clicked && isVisible(clicked)) { setActive(clickedId); return; }
			clickedId = null;
		}

		if (scroller.scrollHeight > scroller.clientHeight + 2 && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) {
			setActive(sections[sections.length - 1].id);
			return;
		}
		const y = scroller.scrollTop + 4;
		let current = sections[0];
		sections.forEach(function (s) {
			if (s.offsetTop <= y) current = s;
		});
		if (current) setActive(current.id);
	}
	scroller.addEventListener("scroll", updateActiveByScroll);
	// Kein sofortiger Aufruf hier: #popup ist beim Laden noch display:none,
	// da waeren alle offsetTop 0 und der letzte Abschnitt wuerde faelschlich
	// als aktiv markiert. popup() ruft stattdessen resetModalScroll() auf,
	// sobald das Fenster tatsaechlich sichtbar ist.
	window.resetModalScroll = function () {
		scroller.scrollTop = 0;
		if (sections[0]) setActive(sections[0].id);
	};
});
