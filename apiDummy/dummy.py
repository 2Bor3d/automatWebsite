import flask;
import json;

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
    return [
    {
        "id": 1,
        "username": "david.glaenzel@gmail.com",
        "password": "12345",
        "groups": ["forschen"],
        "admin": True
    }
    ];


@app.route("/data", methods=["GET"])
def data():
    with open("data.json", "r") as read:
        return json.load(read);


@app.route("/courses", methods=["GET"])
def courses():
    return {
            "Technik": {"day": 3, "people": [1, 2, 3]}, 
            "Informatik": {"day": 4, "people": [4, 5, 6]}, 
            "Physik": {"day": 3, "people": [4, 5, 6]}
            }


if __name__ == "__main__":
    app.run()
