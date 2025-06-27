//function loadSite() {
//    submitF();
//    fetch("/getTeachers", {
//        method: "GET"
//    }).then((response) => {
//        response.json().then((json) => {
//            let opt;
//            console.log(json);
//            json["teachers"].forEach((t) => {
//                opt = document.createElement('option');
//                opt.value = t;
//                opt.text = t;
//                document.getElementById("lehrer").appendChild(opt);
//            });
//            json["admin"].forEach((t) => {
//                opt = document.createElement('option');
//                opt.value = t;
//                opt.text = t;
//                document.getElementById("lehrer").appendChild(opt);
//            });
//        })
//    });
//}

function loadSite() {
    submitF();
    fetch("/get_users", {
        method: "POST"
    }).then((response) => {
        response.json().then((json) => {
            console.log(json)
            list = document.getElementById("user");
            json.forEach((user) => {
                opt = document.createElement("option");
                opt.value = user["id"];
                opt.text = user["firstName"]+" "+user["lastName"];
                list.appendChild(opt);
            });
        });
    });
}

function submitF() {
    document.getElementById("form").addEventListener("submit", function (event) {
        event.preventDefault();
        if (document.getElementById("name").value === "") {
            noContent("Name");
            return;
        }
        if (document.getElementById("user").value === "none") {
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
