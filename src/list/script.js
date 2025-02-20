async function send(address, dict) {
	response = await fetch(address, {
		method: "POST",
		body: JSON.stringify(dict),
		});
	return await response.json();
}

function save(id) {
	first = document.getElementById("firstname").value;
	last = document.getElementById("lastname").value;
	balance = document.getElementById("balance").value;

	send("/change", 
		{"id": id, "first": fist, "last": last, "balance": balance});
}


function popup(id) {
	fetch("/entrys", {
		method: "POST",
		}).then((response) => {response.json().then((json) => {
		json.forEach((student, index, array) => {
			if (student.id == id) {
				popup = document.getElementById("popup");
				popup.classList.remove("hidden");

				document.getElementById("firstname").value = student.first;
				document.getElementById("lastname").value = student.last;
				document.getElementById("balance").value = parseFloat(student.balance);
				document.getElementById("courses").value = student.courses;

				document.getElementById("save")
						.setAtribute("onclick", `save(${id})`);
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
		}).then((response) => {response.json().then((json) => {
			json.forEach((value, index, array) => {
				tr = document.createElement("tr");
				tr.setAttribute("id", `student-${value.id}`);
				table.appendChild(tr);

				first = document.createElement("td");
				first.appendChild(document.createTextNode(value.first));
				tr.appendChild(first);

				last = document.createElement("td");
				last.appendChild(document.createTextNode(value.last));
				tr.appendChild(last);
				
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
