import flask;
import json;
import time;

app = flask.Flask(__name__);


@app.route("/sweets")
def sweets():
    return {"5": {"name": "Haribo", "hours": 2},
            "4": {"name": "Smarties", "hours": 2},
            "7": {"name": "Stats", "hours": -1},
            "6": {"name": "Brause", "hours": 2},
            "1": {"name": "Dublo", "hours": 2},
            "0": {"name": "Mentos", "hours": 2},
            "3": {"name": "Maoam", "hours": 2},
            "2": {"name": "Kinder", "hours": 2}}


@app.route("/alarm_on")
def alarm_on():
    return "success";


@app.route("/alarm_off")
def alarm_off():
    return "success";


@app.route("/dispense", methods=["POST"])
def dispense():
    print(flask.request.json["nr"])
    if flask.request.json["nr"] in range(0, 8):
        return "success";
    else:
        return "response: 235";


@app.route("/ping")
def ping():
    return "1";


@app.route("/fill", methods=["POST"])
def fill():
    print(flask.request.json["name"] + ":" + str(flask.request.json["nr"]))
    return "Added:" + flask.request.json["name"] + ":" + str(flask.request.json["nr"]);


@app.route("/mint")
def mint():
    return {"da": 100, "weg": 150};

########## NICHT FÜR BEN!!!


@app.route("/users", methods=["GET"])
def users():
    with open("users.json", "r") as read:
        return json.load(read);


@app.route("/data", methods=["GET"])
def data():
    with open("data.json", "r") as read:
        return json.load(read);


@app.route("/courses", methods=["GET"])
def courses():
    with open("courses.json", "r") as read:
        return json.load(read);


@app.route("/change_course", methods=["POST"])
def change_courses():
    with open("courses.json", "w") as write:
        json.dump(flask.request.json, write)
        return "success"
    return "fail"


@app.route("/change_user", methods=["POST"])
def change_user():
    with open("data.json", "w") as write:
        json.dump({"people": flask.request.json}, write)
        return "success"
    return "fail"


@app.route("/change_user_file", methods=["POST"])
def change_user_file():
    with open("user.json", "w") as write:
        json.dump(flask.request.json, write)
        return "success"
    return "fail"


@app.route("/scan", methods=["POST"])
def scan():
    time.sleep(6.8);
    return [147, 110, 216, 245, 208];


if __name__ == "__main__":
    app.run()
