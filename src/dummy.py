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


@app.route("/page.html")
def page():
    if flask.request.cookies.get("auth") == "true":
        with open("script.js", "r") as file:
            return file.read();
    else:
        return flask.make_response("authorisation failed"), 403


@app.route("/login", methods=["POST"])
def login():
    print(flask.request.get_json())
    response = flask.make_response("success");
    response.set_cookie("auth", "true");
    return response;


if __name__ == "__main__":
    app.run()
    
