import flask

app = flask.Flask(__name__);

position = "list";

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
            return flask.Response(file.read(), mimetype="text/css");



@app.route("/page.html")
def page():
    if flask.request.cookies.get("auth") == "true":
        print(position)
        with open(f"{position}/index.html", "r") as file:
            return file.read();
    else:
        return flask.make_response("authorisation failed"), 403


@app.route("/page/script.js")
def pageJs():
    if flask.request.cookies.get("auth") == "true":
        with open(f"{position}/script.js", "r") as file:
            return file.read();
    else:
        return flask.make_response("authorisation failed"), 403


@app.route("/page/styles.css")
def pageCss():
    if flask.request.cookies.get("auth") == "true":
        with open(f"{position}/styles.css", "r") as file:
            return flask.Response(file.read(), mimetype="text/css");
    else:
        return flask.make_response("authorisation failed"), 403


@app.route("/login", methods=["POST"])
def login():
    print(flask.request.get_json())
    response = flask.make_response("success");
    response.set_cookie("auth", "true");
    return response;


@app.route("/username", methods=["POST"])
def username():
    return {"username": "Reinhardt", "admin": True, 
            "courses": ["Technik", "Informatik"]};


@app.route("/move", methods=["POST"])
def move():
    global position;
    print(flask.request.get_json())
    position = flask.request.get_json()["position"];
    return flask.make_response("success");


@app.route("/entrys", methods=["POST"])
def entrys():
    return [{"id": 123, "first": "david", "last": "glaenzel", "attendence": ["21", "22"], "time": 5.3},
            {"id": 124, "first": "ben", "last": "schnorri", "attendence": ["32", "54"], "time": 1.2}]


@app.route("/courses", methods=["POST"])
def courses():
    return ["Technik", "Informatik", "Physik"];


@app.route("/logout", methods=["POST"])
def logout():
    response = flask.make_response("success");
    response.set_cookie("auth", "", expires=0);
    return response;


if __name__ == "__main__":
    app.run()

