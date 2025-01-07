function load() {
	fetch("/username", {
		method: "POST"
	}).then((response) => {
		response.json().then((json) => {
			document.getElementById("username").innerText = json["username"];
		})
	})
}

function logout() {
	if (confirm("wollen sie sich ausloggen?")) {
		fetch("/logout", {
			method: "POST"
		}).then(()=>{window.location.reload()});
	}
}

function move(pos) {
	fetch("move", {
		method: "POST",
		body: JSON.stringify({
			position: pos,
		}),
		headers: {"content-type": "application/json; charset=UTF-8",}});
	console.log("moving to: " + pos);
	}
