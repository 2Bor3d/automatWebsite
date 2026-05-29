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
	document.getElementById("name").value = course["name"];
	document.getElementById("day").value = course["day"];

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

				const n = document.createElement("td");
				n.appendChild(document.createTextNode(json["courses"][element]["name"]));
				tr.appendChild(n);

				const dayTd = document.createElement("td");
				dayTd.appendChild(document.createTextNode(json["courses"][element]["day"]));
				tr.appendChild(dayTd);

				const tutors = json["courses"][element]["tutor"] || [];
				const tutorTd = document.createElement("td");
				tutorTd.appendChild(document.createTextNode(
					tutors.length > 0
						? tutors[0]["firstName"] + " " + tutors[0]["lastName"]
						: "—"
				));
				tr.appendChild(tutorTd);

				const punish_button = document.createElement("td");
				const button = document.createElement("button");
				button.setAttribute("onclick", `popup('${element}')`);
				button.innerText = "editieren";
				punish_button.appendChild(button);
				tr.appendChild(punish_button);
			})
		});
	});
}
