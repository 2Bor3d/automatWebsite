function setVisibility(type) {
    switch (type) {
        case "student": {
            document.getElementById("div_password").style.display = "none";
            document.getElementById("div_mail").style.display = "none";
            break;
        }
        case "teacher": {
            document.getElementById("div_password").style.display = "block";
            document.getElementById("div_mail").style.display = "block";
            break;
        }
        case "admin": {
            document.getElementById("div_password").style.display = "block";
            document.getElementById("div_mail").style.display = "block";
            break;
        }
    }
    console.log("SDa")
}

function submitF() {
    document.getElementById("form").addEventListener("submit", function (event) {
        event.preventDefault();
        const type = document.getElementById("type").value;
        console.log(type);
        if (type === "teacher" || type === "admin") {
            if (document.getElementById("mail").value === "") {
                noContent("Mail");
                return;
            }
            if (document.getElementById("password").value === "") {
                noContent("Passwort");
                return;
            }
        }
        if (document.getElementById("name").value === "") {
            noContent("Name");
            return;
        }
        if (document.getElementById("courses").value === "none" && type !== "admin") {
            console.log(document.getElementById("courses").value);
            noContent("Kurs");
            return;
        }
        console.log(type);
        document.getElementById("form").submit();
    });
}

function noContent(feld) {
    window.alert("Bitte füllen Sie das feld " + feld + " aus!");
}