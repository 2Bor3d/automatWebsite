function load() {
	if (localStorage.getItem("barCollapsed") === "1") {
		document.getElementById("bar").classList.add("bar-collapsed");
	}

	fetch("/username", {
		method: "POST"
	}).then((response) => {
		if (!response.ok) throw new Error("HTTP " + response.status);
		return response.json();
	}).then((json) => {
		document.getElementById("username").innerText = json["username"];
		const list = document.getElementById("sub");
		console.log(json)

		// "Alle Kurse" (Tag, Lehrkräfte, Teilnehmende bearbeiten) gibt es nur für
		// Admins. Ein einzelner Kurs führt für alle weiterhin zur nach diesem
		// Kurs gefilterten Nutzerliste - das war schon immer der Zweck dieses
		// Untermenüs und darf durch die Kursübersicht nicht verloren gehen.
		if (json["admin"] == true) {
			const allCourses = document.createElement("p");
			allCourses.setAttribute("onclick", "move('overview', '')");
			allCourses.classList.add("clickable", "sub-all");
			allCourses.innerText = "Alle Kurse";
			list.appendChild(allCourses);
		}
		for (let i = 0; i < json["courses"].length; i++) {
			const p = document.createElement("p");
			p.setAttribute("onclick",
				`move('list', '${json["courses"][i]["id"]}')`);
			p.classList.add("clickable");
			p.innerText = json["courses"][i]["name"];
			list.appendChild(p);
		}
		if (json["admin"] == true) {
			const admin = document.getElementsByClassName("admin");
			for (let i = 0; i < admin.length; i++) {
				admin[i].classList.remove("hidden");
			}
		}

		const pos = json["position"];
		const hasCourse = json["sub"] && json["sub"]["course"];
		const activePos = (pos === "overview" || (pos === "list" && hasCourse)) ? "kurse" : pos;
		const activeEl = document.querySelector(`[data-pos="${activePos}"]`);
		if (activeEl) activeEl.classList.add("nav-active");

		renderViewAs(json);
	}).catch((err) => {
		console.error("Laden der Navigation fehlgeschlagen:", err);
		document.getElementById("username").innerText = "Fehler";
	});
}

function toggleBar() {
	const bar = document.getElementById("bar");
	const collapsed = bar.classList.toggle("bar-collapsed");
	localStorage.setItem("barCollapsed", collapsed ? "1" : "0");
}

// Erlaubt Admins, die Seite testweise so zu sehen, wie eine bestimmte
// Lehrkraft sie sähe (nur deren Kurse, keine Admin-Menüpunkte).
function renderViewAs(json) {
	const container = document.getElementById("viewas-container");
	container.innerHTML = "";

	if (json["viewAsName"]) {
		const banner = document.createElement("span");
		banner.id = "viewas-banner";
		banner.appendChild(document.createTextNode("Ansicht als: " + json["viewAsName"]));
		const stopBtn = document.createElement("button");
		stopBtn.type = "button";
		stopBtn.innerText = "Beenden";
		stopBtn.onclick = stopViewAs;
		banner.appendChild(stopBtn);
		container.appendChild(banner);
		return;
	}

	if (json["admin"] != true) return;

	fetch("/get_users", { method: "POST" }).then((r) => r.json()).then((teachers) => {
		if (!Array.isArray(teachers) || teachers.length === 0) return;
		const select = document.createElement("select");
		select.id = "viewas-select";

		const placeholder = document.createElement("option");
		placeholder.value = "";
		placeholder.innerText = "Ansicht als...";
		select.appendChild(placeholder);

		teachers.forEach((t) => {
			const opt = document.createElement("option");
			opt.value = t.id;
			opt.innerText = t.firstName + " " + t.lastName;
			select.appendChild(opt);
		});

		select.addEventListener("change", () => {
			if (select.value) startViewAs(select.value);
		});
		container.appendChild(select);
	}).catch((err) => console.error("Lehrkräfte konnten nicht geladen werden:", err));
}

function startViewAs(teacherId) {
	fetch("/view_as", {
		method: "POST",
		body: JSON.stringify({ teacherId: teacherId }),
		headers: { "content-type": "application/json; charset=UTF-8" }
	}).then((response) => {
		if (!response.ok) throw new Error("HTTP " + response.status);
		window.location.reload();
	}).catch((err) => {
		console.error("Ansicht wechseln fehlgeschlagen:", err);
		alert("Ansicht konnte nicht gewechselt werden.");
	});
}

function stopViewAs() {
	fetch("/view_as_stop", { method: "POST" }).then((response) => {
		if (!response.ok) throw new Error("HTTP " + response.status);
		window.location.reload();
	}).catch((err) => {
		console.error("Beenden fehlgeschlagen:", err);
		alert("Ansicht konnte nicht beendet werden.");
	});
}

function logout() {
	if (confirm("wollen sie sich ausloggen?")) {
        document.cookie = "auth=;expires=Thu, 01 Jan 1970 00:00:00 UTC;";
		window.location.reload();
	}
}

function expand() {
	const list = document.getElementById("sub");
	if (list.classList.contains("hidden")) {
		list.classList.remove("hidden");
	} else {
		list.classList.add("hidden");
	}
}

function move(pos, sub) {
    const body = (sub == "")
        ? { position: pos, sub: {} }
        : { position: pos, sub: { course: sub } };

	fetch("move", {
		method: "POST",
		body: JSON.stringify(body),
		headers: { "content-type": "application/json; charset=UTF-8", }
	}).then((response) => {
		if (!response.ok) throw new Error("HTTP " + response.status);
		window.location.reload(window.location.href);
	}).catch((err) => {
		console.error("Seitenwechsel fehlgeschlagen:", err);
		alert("Seite konnte nicht gewechselt werden. Bitte erneut versuchen.");
	});
	console.log("moving to: " + pos);
}
