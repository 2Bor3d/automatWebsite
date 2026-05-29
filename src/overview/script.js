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
}

function save(id) {
	name = document.getElementById("name").value;
	day = document.getElementById("day").value;
	students = document.getElementById("students").value;

	const checked = document.querySelectorAll('#user-options input[type="checkbox"]:checked');
	users = Array.from(checked).map(cb => cb.value).join(",");

	send("/change_course", { old: id, name: name, day: day, students: students, users: users });
}

function deleteUser(id) {
	if (confirm("Wollen Sie diesen Kurs wirklich löschen?\nAlle Daten werden restlos gelöscht")) {
		send("/delete_course", { "id": id });
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

async function popup(id) {
	const [coursesRes, usersRes] = await Promise.all([
		fetch("/courses", { method: "POST" }),
		fetch("/get_users", { method: "POST" }),
	]);
	const coursesJson = await coursesRes.json();
	const allUsers = await usersRes.json();

	const course = coursesJson["courses"][id];
	if (!course) return;

	document.getElementById("popup").classList.remove("hidden");
	document.getElementById("name").value = course["name"];
	document.getElementById("day").value = course["day"];
	document.getElementById("students").value = course["students"];

	const selectedIds = course["users"] ? course["users"].split(",").filter(x => x) : [];
	buildUserSelect(allUsers, selectedIds);

	document.getElementById("save").setAttribute("onclick", `save('${id}')`);
	document.getElementById("delete").setAttribute("onclick", `deleteUser('${id}')`);
}

function load() {
	console.log("loading...")
	table = document.getElementById("table");
	fetch("/courses", {
		method: "POST",
	}).then((response) => {
		response.json().then((json) => {
            console.log(json["courses"])
			Object.keys(json["courses"]).forEach((element) => {
                console.log(element)
				tr = document.createElement("tr");
				tr.setAttribute("id", `course-${element}`);
				table.appendChild(tr);

				n = document.createElement("td");
				n.appendChild(document.createTextNode(json["courses"][element]["name"]));
				tr.appendChild(n);

				attendence = document.createElement("td");
				attendence.appendChild(document.createTextNode(
					json["courses"][element]["day"]));
				tr.appendChild(attendence);

				time = document.createElement("td");
				time.appendChild(document.createTextNode(
                    json["courses"][element]["tutor"][0]["firstName"]+" "+
                    json["courses"][element]["tutor"][0]["lastName"]));
				tr.appendChild(time);

				punish_button = document.createElement("td");
				button = document.createElement("button");
				button.setAttribute("onclick", `popup('${element}')`);
				button.innerText = "editieren";
				punish_button.appendChild(button);
				tr.appendChild(punish_button);
			})
		});
	});
}
