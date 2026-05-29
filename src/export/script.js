function load() {
    document.getElementById("form").addEventListener("submit", function (event) {
        event.preventDefault();
        document.getElementById("form").submit();
        //window.parent.location.replace(window.parent.location.href);
    });
    fetch("/courses", {
        method: "POST",
    }).then((response) => {
        response.json().then((json) => {
            console.log(json);
            let opt;
            Object.keys(json["courses"]).forEach((id) => {
                    opt = document.createElement('option');
                    opt.value = id;
                    opt.text = json["courses"][id]["name"];
                    document.getElementById("course").appendChild(opt);
            })
        });
    });
}