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

	const rfidScan = document.getElementById("rfid-scan") && document.getElementById("rfid-scan").checked;

	const payload = {
		"id": id,
		"name": name,
		"hours": parseFloat(balance),
		"date": date,
		"attendance": attendance,
		"courses": courses,
		"gender": gender,
		"birthday": birthday,
		"wohnort": wohnort,
	};
	if (rfidScan) payload["rfid"] = "scan";

	await fetch("/change_user", {
		method: "POST",
		body: JSON.stringify(payload),
		headers: { "content-type": "application/json; charset=UTF-8" },
	});
    closePopup();
    location.reload();
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
    const coursesJson = await coursesRes.json();
    const allCourses = coursesJson["courses"] || {};
    const genders = await gendersRes.json();

    const student = students.find(s => s.id == id);
    if (!student) return;

    document.getElementById("popup").classList.remove("hidden");
    document.getElementById("identification").innerText = "Id: " + student.id;
    document.getElementById("firstName").value = student.firstName;
    document.getElementById("lastName").value = student.lastName;
    document.getElementById("attendanceDate").value = student.attendence;
    document.getElementById("balance").value = student.balance;

    const genderSel = document.getElementById("gender");
    genderSel.innerHTML = "";
    genders.forEach(g => {
        const opt = document.createElement("option");
        opt.value = g; opt.text = g;
        if (g === student.gender) opt.selected = true;
        genderSel.appendChild(opt);
    });

    if (student.birthday) {
        const bd = new Date(student.birthday);
        const yyyy = bd.getUTCFullYear();
        const mm = String(bd.getUTCMonth() + 1).padStart(2, "0");
        const dd = String(bd.getUTCDate()).padStart(2, "0");
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
    if (document.getElementById("rfid-scan")) document.getElementById("rfid-scan").checked = false;

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

				punish_button = document.createElement("td");
				button = document.createElement("button");
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
