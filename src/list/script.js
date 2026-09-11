let _scannedRfid = null;

const WEEKDAY_ADVERBS = {
	MONDTAG: "montags", DEINSTAG: "dienstags", METTWOCH: "mittwochs",
	DÖNNERSTAG: "donnerstags", REINTAG: "freitags", SAUFTAG: "samstags", SONNDAG: "sonntags",
};

function joinNames(names) {
	if (names.length === 0) return "";
	if (names.length === 1) return names[0];
	return names.slice(0, -1).join(", ") + " und " + names[names.length - 1];
}

// Zeigt oberhalb der Liste, an welchem Tag und von wem der Kurs gegeben wird -
// auch wenn man hier nur die Mitglieder ansieht und nichts bearbeitet.
function renderCourseBanner(username) {
	const banner = document.getElementById("course-banner");
	const courseId = username.sub && username.sub.course;
	const course = (username.courses || []).find(c => String(c.id) === String(courseId));

	if (!course) {
		banner.classList.add("hidden");
		banner.textContent = "";
		return;
	}

	const dayText = WEEKDAY_ADVERBS[course.day] || course.day;
	const tutorNames = (course.tutor || []).map(t => t.firstName + " " + t.lastName);
	const tutorText = tutorNames.length ? "geleitet von " + joinNames(tutorNames) : "noch keine Lehrkraft zugewiesen";

	banner.textContent = `${course.name}. ${dayText.charAt(0).toUpperCase()}${dayText.slice(1)}, ${tutorText}.`;
	banner.classList.remove("hidden");
}

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
	response = await fetch(address, {
		method: "POST",
		body: JSON.stringify(dict),
		headers: { "content-type": "application/json; charset=UTF-8", },
	});
	return await response.json();
}

function move(pos, sub) {
	fetch("move", {
		method: "POST",
		body: JSON.stringify({
			position: pos,
			sub: sub
        }),
		headers: { "content-type": "application/json; charset=UTF-8", }
	}).then(
		() => {
			document.location.reload();
		});
	console.log("moving to: " + pos);
}

async function search() {
    term = document.getElementById("search").value;
    username = await (await fetch("/username", {method: "POST",})).json();
    console.log(username["sub"])
    username["sub"]["term"] = term;
    move(username["position"], username["sub"]);
}

function closePopup() {
	document.getElementById("popup").classList.add("hidden");
	document.getElementById("kurs-search").value = "";
}

function buildKursSelect(allCourses, selectedIds) {
	const container = document.getElementById("kurs-options");
	container.innerHTML = "";
	Object.keys(allCourses).forEach(id => {
		const div = document.createElement("div");
		div.className = "kurs-option";

		const cb = document.createElement("input");
		cb.type = "checkbox";
		cb.id = `kurs-cb-${id}`;
		cb.value = id;
		cb.checked = selectedIds.map(String).includes(String(id));

		const label = document.createElement("label");
		label.htmlFor = `kurs-cb-${id}`;
		label.textContent = allCourses[id]["name"];

		div.appendChild(cb);
		div.appendChild(label);
		container.appendChild(div);
	});

	document.getElementById("kurs-search").oninput = function() {
		const term = this.value.toLowerCase();
		container.querySelectorAll(".kurs-option").forEach(el => {
			el.style.display = el.querySelector("label").textContent.toLowerCase().includes(term) ? "" : "none";
		});
	};
}

async function save(id) {
	firstName = document.getElementById("firstName").value;
	lastName = document.getElementById("lastName").value;
	name = firstName + " " + lastName;
	balance = document.getElementById("balance").value;

    attendanceDate = document.getElementById("attendanceDate").value;
    date = Math.floor(new Date(attendanceDate).getTime()/1000);
    attendance = document.getElementById("attendance").value;
    // Nur mitschicken, wenn sich der Status des Tages geändert hat - sonst
    // würde jedes Speichern (z.B. nur des Zeitkontos) den Tag überschreiben.
    const attendanceChanged = attendanceDate && attendance !== currentAttendance(attendanceDate);

	const checked = document.querySelectorAll('#kurs-options input[type="checkbox"]:checked');
	const courses = Array.from(checked).map(cb => cb.value);

	const gender = document.getElementById("gender") ? document.getElementById("gender").value : null;
	const birthdayVal = document.getElementById("birthday") ? document.getElementById("birthday").value : null;
	const birthday = birthdayVal ? new Date(birthdayVal).getTime() : null;

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
		"id": id,
		"name": name,
		"hours": parseFloat(balance),
		"courses": courses,
		"gender": gender,
		"birthday": birthday,
		"wohnort": wohnort,
	};
	if (_scannedRfid) payload["rfid"] = _scannedRfid;
	if (attendanceChanged) {
		payload["date"] = date;
		payload["attendance"] = attendance;
	}

	const result = await fetch("/change_user", {
		method: "POST",
		body: JSON.stringify(payload),
		headers: { "content-type": "application/json; charset=UTF-8" },
	}).then(r => r.text()).catch(() => "fail");
	if (result !== "success") {
		alert("Speichern hat nicht geklappt.");
		return;
	}
    closePopup();
    location.reload();
}

// Status je Tag des gerade geöffneten Schülers, von /student_attendances.
let attendanceMap = {};
const STATUS_TO_OPTION = { normal: "present", excused: "excused", absent: "absent" };

function currentAttendance(isoDate) {
	return STATUS_TO_OPTION[attendanceMap[isoDate]] || "none";
}

// Zeigt im Auswahlfeld, was für den gewählten Tag gerade eingetragen ist.
function syncAttendanceSelect() {
	const isoDate = document.getElementById("attendanceDate").value;
	const select = document.getElementById("attendance");
	select.value = currentAttendance(isoDate);
	colorAttendanceSelect();
}

// Gleiche Farben wie die Tageskästchen in der Liste (siehe styles.css).
function colorAttendanceSelect() {
	const select = document.getElementById("attendance");
	select.dataset.status = select.value;
}

function todayIso() {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function deleteUser(id) {
	if (confirm("Wollen Sie diesen Account wirklich löschen?\nAlle Daten werden restlos gelöscht")) {
		await fetch("/delete_user", {
			method: "POST",
			body: JSON.stringify({ "id": id }),
			headers: { "content-type": "application/json; charset=UTF-8" },
		});
        closePopup();
        location.reload();
	}
}

async function popup(id) {
    const [usernameRes, studentsRes, coursesRes, gendersRes] = await Promise.all([
        fetch("/username", {method: "POST"}),
        fetch("/all_students", {method: "POST"}),
        fetch("/courses", {method: "POST"}),
        fetch("/genders", {method: "POST"}),
    ]);
    username = await usernameRes.json();
    const students = await studentsRes.json();
    // /courses und /genders sind Admin-Endpunkte und antworten Kursleitungen
    // mit 401. Das darf das Popup nicht komplett verhindern - die betroffenen
    // Abschnitte sind für sie ohnehin ausgeblendet (.admin-field).
    const coursesJson = coursesRes.ok ? await coursesRes.json() : {};
    const allCourses = coursesJson["courses"] || {};
    const genders = gendersRes.ok ? await gendersRes.json() : [];

    const student = students.find(s => s.id == id);
    if (!student) return;

    document.getElementById("popup").classList.remove("hidden");
    if (window.resetModalScroll) window.resetModalScroll();
    document.getElementById("identification").innerText = "Id: " + student.id;
    document.getElementById("firstName").value = student.firstName;
    document.getElementById("lastName").value = student.lastName;
    // Anwesenheit trägt man meist für heute ein - der Tag lässt sich im
    // Kalender umstellen, das Auswahlfeld zeigt dann dessen Status.
    const attendanceInput = document.getElementById("attendanceDate");
    attendanceInput.value = todayIso();
    attendanceMap = {};
    syncAttendanceSelect();
    attendanceInput.onchange = syncAttendanceSelect;
    document.getElementById("attendance").onchange = colorAttendanceSelect;
    document.getElementById("balance").value = student.balance;

    fetch("/student_attendances", {
        method: "POST",
        body: JSON.stringify({ id: student.id }),
        headers: { "content-type": "application/json; charset=UTF-8" },
    }).then(r => r.json()).then(highlightMap => {
        attendanceMap = highlightMap;
        syncAttendanceSelect();
        if (attendanceInput.updateDatePickerOptions) {
            attendanceInput.updateDatePickerOptions({ highlightMap });
        }
    }).catch(err => console.error("Anwesenheitshistorie konnte nicht geladen werden:", err));

    const genderSel = document.getElementById("gender");
    genderSel.innerHTML = "";
    genders.forEach(g => {
        const opt = document.createElement("option");
        opt.value = g; opt.text = g;
        if (g === student.gender) opt.selected = true;
        genderSel.appendChild(opt);
    });

    if (student.birthday) {
        // Das Backend liefert Mitternacht in deutscher Zeit (DATE-Spalte). In
        // UTC gelesen wäre das 22/23 Uhr am Vortag - also lokal auslesen.
        const bd = new Date(student.birthday);
        const yyyy = bd.getFullYear();
        const mm = String(bd.getMonth() + 1).padStart(2, "0");
        const dd = String(bd.getDate()).padStart(2, "0");
        document.getElementById("birthday").value = `${yyyy}-${mm}-${dd}`;
    }

    const w = student.wohnort || {};
    document.getElementById("addr-nr").value = w.nr || "";
    document.getElementById("addr-street").value = w.street || "";
    document.getElementById("addr-city").value = w.city || "";
    document.getElementById("addr-zip").value = w.zip || "";
    document.getElementById("addr-country").value = w.country || "";
    if (w.id) document.getElementById("addr-nr").dataset.wohnortId = w.id;

    document.getElementById("rfid-display").textContent = (student.rfid || []).join(", ");
    _scannedRfid = null;
    document.getElementById("rfid-scan-status").textContent = "";
    document.getElementById("rfid-scan-btn").textContent = "Karte scannen";
    document.getElementById("rfid-scan-btn").disabled = false;

    document.getElementById("save").setAttribute("onclick", `save('${id}')`);
    document.getElementById("delete").setAttribute("onclick", `deleteUser('${id}')`);

    buildKursSelect(allCourses, student.kurse || []);

    if (username["admin"]) {
        document.getElementById("firstName").removeAttribute("disabled");
        document.getElementById("lastName").removeAttribute("disabled");
        document.getElementById("delete").removeAttribute("disabled");
        document.querySelectorAll(".admin-field").forEach(el => el.style.display = "");
    } else {
        document.querySelectorAll(".admin-field").forEach(el => el.style.display = "none");
    }
}

function load() {
	console.log("loading...")
	table = document.getElementById("table");

	fetch("/username", { method: "POST" }).then(r => r.json()).then(renderCourseBanner)
		.catch(err => console.error("Kursinfo konnte nicht geladen werden:", err));

	fetch("/all_students", {
		method: "POST",
	}).then((response) => {
		response.json().then((json) => {
			json.forEach((value, index, array) => {
				tr = document.createElement("tr");
				tr.setAttribute("id", `student-${value.id}`);
				table.appendChild(tr);

				fn = document.createElement("td");
				fn.appendChild(document.createTextNode(value.firstName));
				tr.appendChild(fn);

                ln = document.createElement("td");
				ln.appendChild(document.createTextNode(value.lastName));
				tr.appendChild(ln);

				attendence = document.createElement("td");
				attendence.appendChild(document.createTextNode(
					value.attendence));
				tr.appendChild(attendence);

				time = document.createElement("td");
				time.appendChild(document.createTextNode(value.balance));
				tr.appendChild(time);

				const daysTd = document.createElement("td");
				daysTd.style.whiteSpace = "nowrap";
				const STATUS_LABEL = {
					normal: "anwesend", excused: "entschuldigt",
					absent: "abwesend", none: "noch offen",
				};
				(value.recent_days || []).forEach(day => {
					const sq = document.createElement("span");
					sq.className = "day-square " + day.status;
					sq.title = day.date + " – " + (STATUS_LABEL[day.status] || day.status);
					daysTd.appendChild(sq);
				});
				tr.appendChild(daysTd);

				punish_button = document.createElement("td");
				button = document.createElement("button");
				button.className = "edit-btn";
				button.setAttribute("onclick", `popup(${value.id})`);
				button.innerText = "editieren";
				punish_button.appendChild(button);
				tr.appendChild(punish_button);

                if (value.warning == true) {
                    tr.classList.add("warning")
                }
			})
		});
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
