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
    users = document.getElementById("users").value;
    console.log({ "old": id, "name": name, "day": day, "students": students });

	send("/change_course",
		{ old: id, name: name, day: day, students: students, users: users });
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
			Object.keys(json["courses"]).forEach((element) => {
				if (element == id) {
					div = document.getElementById("popup");
					div.classList.remove("hidden");

					document.getElementById("name").value = 
                        json["courses"][element]["name"];
					document.getElementById("day").value = 
                        json["courses"][element]["day"];
					document.getElementById("students").value = 
                        json["courses"][element]["students"];
                    document.getElementById("users").value = 
                        json["courses"][element]["users"];

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
