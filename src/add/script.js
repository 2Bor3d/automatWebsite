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