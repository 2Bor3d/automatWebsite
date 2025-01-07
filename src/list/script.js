function load() {
	console.log("loading...")
	table = document.getElementById("table");
	fetch("/entrys", {
		method: "POST",
		}).then((response) => {response.json().then((json) => {
			json.forEach((value, index, array) => {
				tr = document.createElement("tr");
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
			})
		});
	});
}
