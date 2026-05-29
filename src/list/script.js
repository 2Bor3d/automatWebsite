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

function save(id) {
	firstName = document.getElementById("firstName").value;
	lastName = document.getElementById("lastName").value;
	name = firstName + " " + lastName;
	balance = document.getElementById("balance").value;

    attendanceDate = document.getElementById("attendanceDate").value;
    date = Math.floor(new Date(attendanceDate).getTime()/1000);
    attendance = document.getElementById("attendance").value;

	const checked = document.querySelectorAll('#kurs-options input[type="checkbox"]:checked');
	const courses = Array.from(checked).map(cb => cb.value);

	send("/change_user",
		{ "id": id,
          "name": name,
          "balance": balance,
          "date": date,
          "attendance": attendance,
          "courses": courses });
    closePopup();
    location.reload();
}

function deleteUser(id) {
	if (confirm("Wollen Sie diesen Account wirklich löschen?\nAlle Daten werden restlos gelöscht")) {
		send("/delete_user", { "id": id });
        closePopup();
	}
}

async function popup(id) {
    const [usernameRes, studentsRes, coursesRes] = await Promise.all([
        fetch("/username", {method: "POST"}),
        fetch("/all_students", {method: "POST"}),
        fetch("/courses", {method: "POST"}),
    ]);
    username = await usernameRes.json();
    const students = await studentsRes.json();
    const coursesJson = await coursesRes.json();
    const allCourses = coursesJson["courses"] || {};

    const student = students.find(s => s.id == id);
    if (!student) return;

    document.getElementById("popup").classList.remove("hidden");
    document.getElementById("identification").innerText = "Id: " + student.id;
    document.getElementById("firstName").value = student.firstName;
    document.getElementById("lastName").value = student.lastName;
    document.getElementById("attendanceDate").value = student.attendence;
    document.getElementById("balance").value = student.balance;

    document.getElementById("save").setAttribute("onclick", `save('${id}')`);
    document.getElementById("delete").setAttribute("onclick", `deleteUser('${id}')`);

    buildKursSelect(allCourses, student.kurse || []);

    if (username["admin"]) {
        document.getElementById("firstName").removeAttribute("disabled");
        document.getElementById("lastName").removeAttribute("disabled");
        document.getElementById("delete").removeAttribute("disabled");
        document.querySelector(".admin-field").style.display = "";
    } else {
        document.querySelector(".admin-field").style.display = "none";
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
