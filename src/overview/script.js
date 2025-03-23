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
}

function save(id) {
	name = document.getElementById("name").value;
	day = document.getElementById("day").value;
	students = document.getElementById("students").value;
    console.log({ "old": id, "name": name, "day": day, "students": students });

	send("/change_course",
		{ old: id, name: name, day: day, students: students });
}

function deleteUser(id) {
	if (confirm("Wollen Sie diesen Kurs wirklich löschen?\nAlle Daten werden restlos gelöscht")) {
		send("/delete_course", { "id": id });
	}
}

function popup(id) {
	fetch("/courses", {
		method: "POST",
	}).then((response) => {
		response.json().then((json) => {
			Object.keys(json).forEach((value, index, array) => {
				if (value == id) {
					div = document.getElementById("popup");
					div.classList.remove("hidden");

					document.getElementById("name").value = value;
					document.getElementById("day").value = json[value]["day"];
					document.getElementById("students").value = 
                        json[value]["students"];

					document.getElementById("close")
						.setAttribute("onclick", `closePopup()`);
					document.getElementById("save")
						.setAttribute("onclick", `save('${id}')`);
					document.getElementById("delete")
						.setAttribute("onclick", `deleteUser('${id}')`);
				}
			});
		});
	})
}

function load() {
	console.log("loading...")
	table = document.getElementById("table");
	fetch("/courses", {
		method: "POST",
	}).then((response) => {
		response.json().then((json) => {
            console.log(json)
			Object.keys(json).forEach((value, index, array) => {
				tr = document.createElement("tr");
				tr.setAttribute("id", `course-${value}`);
				table.appendChild(tr);

				n = document.createElement("td");
				n.appendChild(document.createTextNode(value));
				tr.appendChild(n);

				attendence = document.createElement("td");
				attendence.appendChild(document.createTextNode(
					json[value]["day"]));
				tr.appendChild(attendence);

				time = document.createElement("td");
				time.appendChild(document.createTextNode(
                    json[value]["students"]));
				tr.appendChild(time);

				punish_button = document.createElement("td");
				button = document.createElement("button");
				button.setAttribute("onclick", `popup('${value}')`);
				button.innerText = "editieren";
				punish_button.appendChild(button);
				tr.appendChild(punish_button);
			})
		});
	});
}
