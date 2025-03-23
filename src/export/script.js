function load() {
    document.getElementById("form").addEventListener("submit", function (event) {
        event.preventDefault();
        document.getElementById("form").submit();
        window.parent.location.replace(window.parent.location.href);
    });
    fetch("/courses", {
        method: "POST",
    }).then((response) => {
        response.json().then((json) => {
            console.log(json);
            let opt;
            Object.keys(json).forEach((t, index, array) => {
                    opt = document.createElement('option');
                    opt.value = t;
                    opt.text = t;
                    document.getElementById("course").appendChild(opt);
            })
        });
    });
}