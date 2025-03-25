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
}

function save(id) {
	name = document.getElementById("name").value;
	balance = document.getElementById("balance").value;

    attendanceDate = document.getElementById("attendanceDate").value;
    date = Math.floor(new Date(attendanceDate).getTime()/1000);
    attendance = document.getElementById("attendance").value;

	send("/change_user",
		{ "id": id,
          "name": name,
          "balance": balance,
          "date": date,
          "attendance": attendance });
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
    username = await (await fetch("/username", {method: "POST",})).json();
	fetch("/entrys", {
		method: "POST",
	}).then((response) => {
		response.json().then((json) => {
			json.forEach((student, index, array) => {
				if (student.id == id) {
					div = document.getElementById("popup");
					div.classList.remove("hidden");

                    document.getElementById("identification").innerText = "Id: " + student.id;

					document.getElementById("name").value = student.name;
					document.getElementById("balance").value = student.balance;

					document.getElementById("close")
						.setAttribute("onclick", `closePopup()`);
					document.getElementById("save")
						.setAttribute("onclick", `save('${id}')`);
					document.getElementById("delete")
						.setAttribute("onclick", `deleteUser('${id}')`);
                    
                    if (username["admin"]) {
                        document.getElementById("name").removeAttribute("disabled");
                        document.getElementById("delete").removeAttribute("disabled");
                    }
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
