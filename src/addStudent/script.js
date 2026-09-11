function load() {
    fetch("/genders", {
        method: "POST"
    }).then((response) => {
        response.json().then((json) => {
            element = document.getElementById("gender");
            json.forEach((gender) => {
                opt = document.createElement("option");
                opt.text = gender;
                opt.value = gender;
                element.appendChild(opt);
            });
        });
    });

    fetch("/courses", {
        method: "POST"
    }).then((response) => {
        response.json().then((json) => {
            const sel = document.getElementById("kurs");
            if (!sel) return;
            Object.keys(json["courses"]).forEach((id) => {
                const opt = document.createElement("option");
                opt.value = id;
                opt.text = json["courses"][id]["name"];
                sel.appendChild(opt);
            });
        });
    });
}

function change_type() {
    type = document.getElementById("type").value;
    if (type=="ADMIN" || type=="TEACHER") {
        for (const element of document.getElementsByClassName("admin")) {
            element.classList.remove("hidden");
        }
        document.getElementById("kurs-field").style.display = "none";
    } else {
        for (const element of document.getElementsByClassName("admin")) {
            element.classList.add("hidden");
        }
        document.getElementById("kurs-field").style.display = "";
    }
}


// Zeigt die Rückfrage und liefert das Ergebnis als Promise.
function confirmNoCard() {
    return new Promise((resolve) => {
        const overlay = document.getElementById("confirm-overlay");
        const ok = document.getElementById("confirm-ok");
        const cancel = document.getElementById("confirm-cancel");

        function close(answer) {
            overlay.classList.add("hidden");
            ok.removeEventListener("click", onOk);
            cancel.removeEventListener("click", onCancel);
            overlay.removeEventListener("click", onBackdrop);
            document.removeEventListener("keydown", onKey);
            resolve(answer);
        }
        function onOk() { close(true); }
        function onCancel() { close(false); }
        function onBackdrop(e) { if (e.target === overlay) close(false); }
        function onKey(e) { if (e.key === "Escape") close(false); }

        ok.addEventListener("click", onOk);
        cancel.addEventListener("click", onCancel);
        overlay.addEventListener("click", onBackdrop);
        document.addEventListener("keydown", onKey);

        overlay.classList.remove("hidden");
        cancel.focus();
    });
}

async function submit() {
    const message = document.getElementById("message");

    type = document.getElementById("type").value;

    firstName = document.getElementById("firstName").value.trim();
    lastName = document.getElementById("lastName").value.trim();
    const wantsCard = document.getElementById("rfid").checked;
    rfid = "false";
    gender = document.getElementById("gender").value;
    // Leere Zahlenfelder ergeben NaN, das JSON.stringify zu null macht - damit
    // lehnt das Backend den ganzen Datensatz ab. Deshalb auf 0 zurückfallen.
    const birthdayRaw = new Date(document.getElementById("birthday").value).getTime();
    birthday = Number.isNaN(birthdayRaw) ? 0 : birthdayRaw;
    nr = parseInt(document.getElementById("nr").value) || 0;
    street = document.getElementById("street").value;
    city = document.getElementById("city").value;
    zip = parseInt(document.getElementById("zip").value) || 0;
    country = document.getElementById("country").value;

    email = document.getElementById("email").value;
    password = document.getElementById("password").value;

    if (!firstName || !lastName) {
        message.innerText = "Vor- und Nachname sind erforderlich.";
        return;
    }

    // Mit Karte wird der Schüler nur vorgemerkt - angelegt wird er erst, wenn
    // die Karte am Automaten gescannt wird. Ohne Karte wird sofort angelegt,
    // dann aber mit Rückfrage.
    rfid = wantsCard ? "true" : "false";
    if (!wantsCard && !(await confirmNoCard())) {
        message.innerText = "";
        return;
    }

    message.innerText = "Verarbeitung…";

    level = "NORMAL";
    if (type=="ADMIN") {level="ADMIN"};

    if (type=="TEACHER" || type=="ADMIN") {
        fetch("/add_teacher", {
            method: "POST",
            body: JSON.stringify({
                "firstName": firstName,
                "lastName": lastName,
                "rfid": rfid,
                "gender": gender,
                "birthday": birthday,
                "address": {
                    "nr": nr,
                    "street": street,
                    "city": city,
                    "zip": zip,
                    "country": country,
                },
                "email": email,
                "password": password,
                "level": level,
            }),
            headers: {
                "Content-type": "application/json; charset=UTF-8",
            }
        }).then((response) => response.text()).then((text) => {
            if (text != "success") {
                message.innerText = "Konnte nicht angelegt werden: " + text;
                return;
            }
            message.innerText = wantsCard
                ? "Angelegt. Chipkarte jetzt über „Lehrkräfte → bearbeiten → Karte scannen“ zuweisen."
                : "Erfolgreich hinzugefügt!";
        }).catch((err) => {
            console.error("Anlegen fehlgeschlagen:", err);
            message.innerText = "Konnte nicht angelegt werden.";
        });
    } else {
        const kursEl = document.getElementById("kurs");
        const kurse = kursEl && kursEl.value ? [parseInt(kursEl.value)] : [];
        fetch("/add_student", {
            method: "POST",
            body: JSON.stringify({
                "firstName": firstName,
                "lastName": lastName,
                "rfid": rfid,
                "gender": gender,
                "birthday": birthday,
                "address": {
                    "nr": nr,
                    "street": street,
                    "city": city,
                    "zip": zip,
                    "country": country,
                },
                "kurse": kurse
            }),
            headers: {
                "Content-type": "application/json; charset=UTF-8",
            }
        }).then((response) => response.text()).then((text) => {
            if (text === "queued") {
                message.innerText = `${firstName} ${lastName} ist vorgemerkt. `
                    + "Jetzt am Automaten „Nutzer hinzufügen“ öffnen und die "
                    + "Chipkarte scannen - damit ist die Person angelegt.";
                return;
            }
            message.innerText = text === "success"
                ? "Erfolgreich hinzugefügt!"
                : "Konnte nicht angelegt werden: " + text;
        }).catch((err) => {
            console.error("Anlegen fehlgeschlagen:", err);
            message.innerText = "Konnte nicht angelegt werden.";
        });
    }
}

