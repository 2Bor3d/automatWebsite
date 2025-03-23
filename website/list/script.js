function reward(id) {
	console.log(id);
	td = document.getElementById(`student-${id}`);
	dropdown = document.createElement("div");

}

function punish(student) {
	tr = document.getElementById(`student-${student}`);
	console.log(tr.innerText)
	dropdown = document.createElement("p")
	dropdown.innerText = "1234"
	dropdown.classList.add("dropdown")
	tr.appendChild(dropdown)
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
				attendence.appendChild(
					document.createTextNode(value.attendence));
				tr.appendChild(attendence);

				time = document.createElement("td");
				time.appendChild(document.createTextNode(value.time));
				tr.appendChild(time);
				
				time = document.createElement("td");
				time.appendChild(document.createTextNode(value.time));
				tr.appendChild(time);

				punish_button = document.createElement("td");
				button = document.createElement("button");
				button.setAttribute("onclick", `punish(${value.id})`);
				button.innerText = "belohnen/bestrafen";
				punish_button.appendChild(button);
				tr.appendChild(punish_button);
			})
		});
	});
}
