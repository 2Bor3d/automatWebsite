function loadSite() {
    submitF();
    fetch("/getTeachers", {
        method: "POST"
    }).then((response) => {
        response.json().then((json) => {
            let opt;
            for (const key in json["teachers"]) {
                opt = document.createElement('option');
                opt.value = key;
                opt.text = key;
                document.getElementById("leherer").appendChild(opt);
            }
            for (const key in json["admin"]) {
                opt = document.createElement('option');
                opt.value = key;
                opt.text = key;
                document.getElementById("leherer").appendChild(opt);
            }
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
        if (document.getElementById("leherer").value === "none") {
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