function load() {
	fetch("/username", {
		method: "POST"
	}).then((response) => {
		response.json().then((json) => {
			document.getElementById("username").innerText = json["username"];
			list = document.getElementById("sub");
			console.log(json)
			for (i = 0; i < json["courses"].length; i++) {
				p = document.createElement("p");
				p.setAttribute("onclick",
					`move('list', '${json["courses"][i]["id"]}')`);
				p.classList.add("clickable");
				p.innerText = json["courses"][i]["name"];
				list.appendChild(p);
			}
			if (json["admin"] == true) {
				admin = document.getElementsByClassName("admin");
				for (i = 0; i < admin.length; i++) {
					admin[i].classList.remove("hidden");
				};
			};
		})
	});
}

function logout() {
	if (confirm("wollen sie sich ausloggen?")) {
        document.cookie = "auth=;expires=Thu, 01 Jan 1970 00:00:00 UTC;";
		window.location.reload();
	}
}

function expand() {
	list = document.getElementById("sub");
	if (list.classList.contains("hidden")) {
		list.classList.remove("hidden");
	} else {
		list.classList.add("hidden");
	}
}

function move(pos, sub) {
	fetch("move", {
		method: "POST",
		body: JSON.stringify({
			position: pos,
			sub: {
				course: sub,
			}
		}),
		headers: { "content-type": "application/json; charset=UTF-8", }
	}).then(
		() => {
			window.location.reload(window.location.href);
			//document.getElementById("iframe").contentWindow.location.reload();
		});
	console.log("moving to: " + pos);
}
