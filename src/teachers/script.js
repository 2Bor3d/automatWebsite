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
		const bd = new Date(teacher.birthday);
		const yyyy = bd.getUTCFullYear();
		const mm = String(bd.getUTCMonth() + 1).padStart(2, "0");
		const dd = String(bd.getUTCDate()).padStart(2, "0");
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
		rfid: teacher ? (teacher.rfid || []) : [],
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
		btn.setAttribute("onclick", `popup(${teacher.id})`);
		btn.innerText = "editieren";
		td.appendChild(btn);
		tr.appendChild(td);
		table.appendChild(tr);
	});
}
