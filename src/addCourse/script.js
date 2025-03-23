function loadSite() {
    submitF();
    fetch("/getTeachers", {
        method: "GET"
    }).then((response) => {
        response.json().then((json) => {
            let opt;
            console.log(json);
            json["teachers"].forEach((t) => {
                opt = document.createElement('option');
                opt.value = t;
                opt.text = t;
                document.getElementById("lehrer").appendChild(opt);
            });
            json["admin"].forEach((t) => {
                opt = document.createElement('option');
                opt.value = t;
                opt.text = t;
                document.getElementById("lehrer").appendChild(opt);
            });
        })
    });
}

function submitF() {
    document.getElementById("form").addEventListener("submit", function (event) {
        event.preventDefault();
        if (document.getElementById("name").value === "") {
            noContent("Name");
            return;
        }
        if (document.getElementById("lehrer").value === "none") {
            console.log(document.getElementById("courses").value);
            noContent("Kurs");
            return;
        }
        document.getElementById("form").submit();
    });
}

function noContent(feld) {
    window.alert("Bitte füllen Sie das feld " + feld + " aus!");
}