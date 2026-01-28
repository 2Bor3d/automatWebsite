function load() {
    fetch("/genders", {
        method: "POST"
    }).then((response) => {
        response.json().then((json) => {
            console.log(json)
            element = document.getElementById("gender");
            json.forEach((gender) => {
                opt = document.createElement("option");
                opt.text = gender;
                opt.value = gender;
                element.appendChild(opt);
            });
        });
    });
}

function change_type() {
    type = document.getElementById("type").value;
    console.log(type)
    if (type=="ADMIN" || type=="TEACHER") {
        for (const element of document.getElementsByClassName("admin")) {
            element.classList.remove("hidden");
        };
    } else {
        for (const element of document.getElementsByClassName("admin")) {
            element.classList.add("hidden");
        };
    }
}


function submit() {
    document.getElementById("message").text = "Verarbeitung...";

    type = document.getElementById("type").value;

    firstName = document.getElementById("firstName").value;
    lastName = document.getElementById("lastName").value;
    rfid = document.getElementById("rfid").checked ? "false" : "true";
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
                "password": password
            }),
            headers: {
                "Content-type": "application/json; charset=UTF-8",
            }

        }).then((response) => {
            if (response.text == "success") {
                document.getElementById("message").text = "Erfolgreich hinzugefügt!";
            }
        });
    } else {
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
                "kurse": [1]
            }),
            headers: {
                "Content-type": "application/json; charset=UTF-8",
            }
        }).then((response) => {
            response.text().then((text) => {;
                console.log(text)
                if (text == "success") {
                    document.getElementById("message").innerText = "Erfolgreich hinzugefügt!";
                }
            });
        });
    }
}

