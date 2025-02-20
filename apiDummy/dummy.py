import flask;

app = flask.Flask(__name__);


@app.route("/sweets")
def sweets():
    return {"5": {"name": "Gummi", "hours": 2}, 
            "4": {"name": "Smarties", "hours": 2,}, 
            "7": {"name": "Stats", "hours": -1}, 
            "6": {"name": "Pickup", "hours": 2}, 
            "1": {"name": "Dublo", "hours": 2}, 
            "0": {"name": "Mentos", "hours": 2}, 
            "3": {"name": "Maoam", "hours": 2}, 
            "2": {"name": "Kinder", "hours": 2}}

@app.route("/alarm_on", methods=["POST"])
def alarm_on():
    return "success";

@app.route("/alarm_off", methods=["POST"])
def alarm_off():
        return "success";

@app.route("/dispense", methods=["POST"])
def dispense():
    if flask.request.json["nr"] in range(0, 8):
        return "success";
    else:
        return "error: 235";

if __name__ == "__main__":
    app.run()

