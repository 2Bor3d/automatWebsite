function login() {
	fetch("login", {
		method: "POST",
		body: JSON.stringify({
			user: document.getElementById("user").value,
			pwd: document.getElementById("pwd").value,
		}),
		headers: {
			"Content-type": "application/json; charset=UTF-8",
		}
	}).then(() => {window.location.reload()});
}

function pressed(event, button) {
	if (event.keyCode===13) {
		if (button==="user") {
			document.getElementById("pwd").focus();
		}
		if (button==="pwd") {
			login();
		}
	}
}
