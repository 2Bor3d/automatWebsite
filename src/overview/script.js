async function send(address, dict) {
	response = await fetch(address, {
		method: "POST",
		body: JSON.stringify(dict),
		headers: { "content-type": "application/json; charset=UTF-8", },
	});
	return await response.json();
}

function closePopup() {
	document.getElementById("popup").classList.add("hidden");
	document.getElementById("user-search").value = "";
	document.getElementById("student-search").value = "";
}

function joinNames(names) {
	if (names.length === 0) return "";
	if (names.length === 1) return names[0];
	return names.slice(0, -1).join(", ") + " und " + names[names.length - 1];
}

const WEEKDAY_ADVERBS = {
	MONDTAG: "montags", DEINSTAG: "dienstags", METTWOCH: "mittwochs",
	DÖNNERSTAG: "donnerstags", REINTAG: "freitags", SAUFTAG: "samstags", SONNDAG: "sonntags",
};

function describeCourse(course) {
	const dayText = WEEKDAY_ADVERBS[course["day"]] || course["day"];
	const tutorNames = (course["tutor"] || []).map(t => t.firstName + " " + t.lastName);
	if (tutorNames.length === 0) {
		return dayText.charAt(0).toUpperCase() + dayText.slice(1) + ". Noch keine Lehrkraft zugewiesen.";
	}
	return dayText.charAt(0).toUpperCase() + dayText.slice(1) + ", geleitet von " + joinNames(tutorNames) + ".";
}

function save(id) {
	const name = document.getElementById("name").value;
	const day = document.getElementById("day").value;

	const checkedUsers = document.querySelectorAll('#user-options input[type="checkbox"]:checked');
	const users = Array.from(checkedUsers).map(cb => cb.value).join(",");

	const checkedStudents = document.querySelectorAll('#student-options input[type="checkbox"]:checked');
	const students = Array.from(checkedStudents).map(cb => cb.value);

	fetch("/change_course", {
		method: "POST",
		body: JSON.stringify({ old: id, name: name, day: day, users: users, students: students }),
		headers: { "content-type": "application/json; charset=UTF-8" },
	}).then(() => { closePopup(); load(); });
}

function deleteUser(id) {
	if (confirm("Wollen Sie diesen Kurs wirklich löschen?\nAlle Daten werden restlos gelöscht")) {
		fetch("/delete_course", {
			method: "POST",
			body: JSON.stringify({ id: id }),
			headers: { "content-type": "application/json; charset=UTF-8" },
		}).then(() => { closePopup(); load(); });
	}
}

function buildUserSelect(allUsers, selectedIds) {
	const container = document.getElementById("user-options");
	container.innerHTML = "";
	allUsers.forEach(user => {
		const div = document.createElement("div");
		div.className = "user-option";

		const cb = document.createElement("input");
		cb.type = "checkbox";
		cb.id = `user-cb-${user.id}`;
		cb.value = user.id;
		cb.checked = selectedIds.includes(String(user.id));

		const label = document.createElement("label");
		label.htmlFor = `user-cb-${user.id}`;
		label.textContent = user.firstName + " " + user.lastName;

		div.appendChild(cb);
		div.appendChild(label);
		container.appendChild(div);
	});

	document.getElementById("user-search").oninput = function() {
		const term = this.value.toLowerCase();
		container.querySelectorAll(".user-option").forEach(el => {
			el.style.display = el.querySelector("label").textContent.toLowerCase().includes(term) ? "" : "none";
		});
	};
}

function buildStudentSelect(allStudents, selectedIds) {
	const container = document.getElementById("student-options");
	container.innerHTML = "";
	allStudents.forEach(student => {
		const div = document.createElement("div");
		div.className = "student-option";

		const cb = document.createElement("input");
		cb.type = "checkbox";
		cb.id = `student-cb-${student.id}`;
		cb.value = student.id;
		cb.checked = selectedIds.map(String).includes(String(student.id));

		const label = document.createElement("label");
		label.htmlFor = `student-cb-${student.id}`;
		label.textContent = student.firstName + " " + student.lastName;

		div.appendChild(cb);
		div.appendChild(label);
		container.appendChild(div);
	});

	document.getElementById("student-search").oninput = function() {
		const term = this.value.toLowerCase();
		container.querySelectorAll(".student-option").forEach(el => {
			el.style.display = el.querySelector("label").textContent.toLowerCase().includes(term) ? "" : "none";
		});
	};
}

async function popup(id) {
	const [coursesRes, usersRes, studentNamesRes] = await Promise.all([
		fetch("/courses", { method: "POST" }),
		fetch("/get_users", { method: "POST" }),
		fetch("/student_names", { method: "POST" }),
	]);
	const coursesJson = await coursesRes.json();
	const allUsers = await usersRes.json();
	const allStudents = await studentNamesRes.json();

	const course = coursesJson["courses"][id];
	if (!course) return;

	document.getElementById("popup").classList.remove("hidden");
	if (window.resetModalScroll) window.resetModalScroll();
	document.getElementById("name").value = course["name"];
	document.getElementById("day").value = course["day"];
	document.getElementById("course-meta").textContent = describeCourse(course);

	const selectedTutorIds = course["users"] ? course["users"].split(",").filter(x => x) : [];
	buildUserSelect(allUsers, selectedTutorIds);

	const participants = course["participants"] || [];
	const selectedStudentIds = participants.map(s => s.id);
	buildStudentSelect(Array.isArray(allStudents) ? allStudents : [], selectedStudentIds);

	document.getElementById("save").setAttribute("onclick", `save('${id}')`);
	document.getElementById("delete").setAttribute("onclick", `deleteUser('${id}')`);
}

function load() {
	console.log("loading...")
	const table = document.getElementById("table");
	fetch("/courses", {
		method: "POST",
	}).then((response) => {
		response.json().then((json) => {
			table.querySelectorAll("tr:not(:first-child)").forEach(r => r.remove());
			Object.keys(json["courses"]).forEach((element) => {
				const tr = document.createElement("tr");
				tr.setAttribute("id", `course-${element}`);
				table.appendChild(tr);

				// Der Name führt zur Schülerübersicht des Kurses, nicht zum
				// Bearbeiten-Popup - das öffnet ausschließlich der
				// "editieren"-Knopf.
				const n = document.createElement("td");
				n.className = "course-name";
				n.addEventListener("click", () => window.parent.move("list", element));
				n.appendChild(document.createTextNode(json["courses"][element]["name"]));
				tr.appendChild(n);

				const dayTd = document.createElement("td");
				const dayOpt = document.querySelector(`#day option[value="${json["courses"][element]["day"]}"]`);
				dayTd.appendChild(document.createTextNode(dayOpt ? dayOpt.textContent : json["courses"][element]["day"]));
				tr.appendChild(dayTd);

				const tutors = json["courses"][element]["tutor"] || [];
				const tutorTd = document.createElement("td");
				tutorTd.appendChild(document.createTextNode(
					tutors.length > 0
						? joinNames(tutors.map(t => t["firstName"] + " " + t["lastName"]))
						: "—"
				));
				tr.appendChild(tutorTd);

				// Öffnet die eigentliche Mitgliederliste (mit Anwesenheit,
				// Zeitkonto, ...) statt des Bearbeiten-Popups - das lebt in der
				// Sidebar/Nutzerliste, daher der Umweg über den übergeordneten
				// Frame (move() ist dort definiert, nicht in diesem iframe).
				const membersTd = document.createElement("td");
				const membersLink = document.createElement("span");
				membersLink.className = "members-link";
				const count = (json["courses"][element]["participants"] || []).length;
				membersLink.appendChild(document.createTextNode(`${count} ansehen`));
				membersLink.addEventListener("click", () => window.parent.move("list", element));
				membersTd.appendChild(membersLink);
				tr.appendChild(membersTd);

				const punish_button = document.createElement("td");
				const button = document.createElement("button");
				button.className = "edit-btn";
				button.setAttribute("onclick", `popup('${element}')`);
				button.innerText = "editieren";
				punish_button.appendChild(button);
				tr.appendChild(punish_button);
			})

			// Von der Sidebar aus kann ein bestimmter Kurs direkt angesprungen
			// werden (Kursübersicht -> Kursname); dessen Popup öffnet sich dann
			// sofort, statt dass man ihn erst in der Tabelle suchen muss.
			fetch("/username", { method: "POST" }).then(r => r.json()).then(u => {
				const courseId = u.sub && u.sub.course;
				if (courseId) popup(String(courseId));
			});
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
