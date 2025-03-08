async function send(address, dict) {
	response = await fetch(address, {
		method: "POST",
		body: JSON.stringify(dict),
	});
	return await response.json();
}

function closePopup() {
	document.getElementById("popup").classList.add("hidden");
}

function save(id) {
	first = document.getElementById("firstname").value;
	last = document.getElementById("lastname").value;
	balance = document.getElementById("balance").value;

	send("/change",
		{ "id": id, "first": fist, "last": last, "balance": balance });
}

function deleteUser(id) {
	if (confirm("Wollen Sie diesen Account wirklich löschen?\nAlle Daten werden restlos gelöscht")) {
		send("/delete", { "id": id });
	}
}

function popup(id) {
	fetch("/entrys", {
		method: "POST",
	}).then((response) => {
		response.json().then((json) => {
			json.forEach((student, index, array) => {
				if (student.id == id) {
					div = document.getElementById("popup");
					div.classList.remove("hidden");

					document.getElementById("name").value = student.name;
					document.getElementById("balance").value = student.balance;
					document.getElementById("courses").value = student.courses;

					document.getElementById("close")
						.setAttribute("onclick", `closePopup()`);
					document.getElementById("save")
						.setAttribute("onclick", `save(${id})`);
					document.getElementById("delete")
						.setAttribute("onclick", `deleteUser(${id})`);
				}
			});
		});
	})
}

function load() {
	console.log("loading...")
	table = document.getElementById("table");
	fetch("/entrys", {
		method: "POST",
	}).then((response) => {
		response.json().then((json) => {
			json.forEach((value, index, array) => {
				tr = document.createElement("tr");
				tr.setAttribute("id", `student-${value.id}`);
				table.appendChild(tr);

				n = document.createElement("td");
				n.appendChild(document.createTextNode(value.name));
				tr.appendChild(n);

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
			})
		});
	});
}
