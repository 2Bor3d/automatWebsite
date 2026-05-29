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


function submit() {
    document.getElementById("message").text = "Verarbeitung...";

    type = document.getElementById("type").value;

    firstName = document.getElementById("firstName").value;
    lastName = document.getElementById("lastName").value;
    rfid = document.getElementById("rfid").checked ? "true" : "false";
    gender = document.getElementById("gender").value;
    birthday = new Date(document.getElementById("birthday").value).getTime();
    nr = parseInt(document.getElementById("nr").value);
    street = document.getElementById("street").value;
    city = document.getElementById("city").value;
    zip = parseInt(document.getElementById("zip").value);
    country = document.getElementById("country").value;

    email = document.getElementById("email").value;
    password = document.getElementById("password").value;

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
        }).then((response) => {
            response.text().then((text) => {
                if (text == "success") {
                    document.getElementById("message").innerText = "Erfolgreich hinzugefügt!";
                }
            });
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
        }).then((response) => {
            response.text().then((text) => {
                if (text == "success") {
                    document.getElementById("message").innerText = "Erfolgreich hinzugefügt!";
                }
            });
        });
    }
}

