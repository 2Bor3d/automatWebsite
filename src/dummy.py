import flask

app = flask.Flask(__name__);

@app.route("/")
def index():
    if flask.request.cookies.get("auth") == "true":
        with open("index.html", "r") as file:
            return file.read();
    else:
        with open("login/index.html", "r") as file:
            return file.read();


@app.route("/script.js")
def script():
    if flask.request.cookies.get("auth") == "true":
        with open("script.js", "r") as file:
            return file.read();
    else:
        with open("login/script.js", "r") as file:
            return file.read();


@app.route("/styles.css")
def styles():
    if flask.request.cookies.get("auth") == "true":
        with open("styles.css", "r") as file:
            return flask.Response(file.read(), mimetype="text/css");
    else:
        with open("login/styles.css", "r") as file:
            return file.read();


@app.route("/page.html")
def page():
    if flask.request.cookies.get("auth") == "true":
        with open("list/index.html", "r") as file:
            return file.read();
    else:
        return flask.make_response("authorisation failed"), 403


@app.route("/page/script.js")
def pageJs():
    if flask.request.cookies.get("auth") == "true":
        with open("list/script.js", "r") as file:
            return file.read();
    else:
        return flask.make_response("authorisation failed"), 403


@app.route("/login", methods=["POST"])
def login():
    print(flask.request.get_json())
    response = flask.make_response("success");
    response.set_cookie("auth", "true");
    return response;


@app.route("/entrys", methods=["POST"])
def entrys():
    return [{"first": "david", "last": "glaenzel", "attendence": ["21", "22"], "time": 5.3},
            {"first": "ben", "last": "schnorri", "attendence": ["32", "54"], "time": 1.2}]


if __name__ == "__main__":
    app.run()
    
