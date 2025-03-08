import flask
import requests
import json
import base64
import os
import csv as csvBib
import collections
from datetime import datetime;

from flask import send_file

app = flask.Flask(__name__);

position = "list";

logedin = {};


def checkAuth(auth: str) -> bool:
    print(auth)
    print(logedin)
    if auth in logedin:
        print("success");
        return True;
    return False;


@app.route("/")
def index():
    if checkAuth(flask.request.cookies.get("auth")):
        with open("index.html", "r") as file:
            return file.read();
    else:
        with open("login/index.html", "r") as file:
            return file.read();


@app.route("/script.js")
def script():
    if checkAuth(flask.request.cookies.get("auth")):

        with open("script.js", "r") as file:
            return file.read();
    else:
        with open("login/script.js", "r") as file:
            return file.read();


@app.route("/styles.css")
def styles():
    if checkAuth(flask.request.cookies.get("auth")):
        with open("styles.css", "r") as file:
            return flask.Response(file.read(), mimetype="text/css");
    else:
        with open("login/styles.css", "r") as file:
            return flask.Response(file.read(), mimetype="text/css");



@app.route("/page.html")
def page():
    if checkAuth(flask.request.cookies.get("auth")):
        print(position)
        with open(f"{position}/index.html", "r") as file:
            return file.read();
    else:
        return flask.make_response("authorisation failed"), 401


@app.route("/page/script.js")
def pageJs():
    if checkAuth(flask.request.cookies.get("auth")):
        with open(f"{position}/script.js", "r") as file:
            return file.read();
    else:
        return flask.make_response("authorisation failed"), 401


@app.route("/page/styles.css")
def pageCss():
    if checkAuth(flask.request.cookies.get("auth")):
        with open(f"{position}/styles.css", "r") as file:
            return flask.Response(file.read(), mimetype="text/css");
    else:
        return flask.make_response("authorisation failed"), 401


@app.route("/login", methods=["POST"])
def login():
    attempt = flask.request.get_json();
    r = requests.get("http://192.168.4.1/users");
    print(r.content)

    users = json.loads(r.text);
    print(attempt)
    print(users)
    response = flask.make_response("wrong username or password", 401)
    for user in users:
        if user["username"] == attempt["username"] and user["password"] == attempt["password"]:
            random_bytes = base64.b64encode(os.urandom(32)).decode("utf-8");
            ############################################# fails 1/1431655765 times
            logedin[random_bytes] = {"username": user["username"], "admin": user["admin"], "courses": user["groups"]};
            response = flask.make_response("success", 200);
            response.set_cookie("auth", random_bytes);
            break;
    return response;


#@app.route("/login", methods=["POST"])
def login():
    print(flask.request.get_json())
    response = flask.make_response("success");
    response.set_cookie("auth", "true");
    return response;


@app.route("/username", methods=["POST"])
def username():
    if checkAuth(flask.request.cookies.get("auth")):
        return logedin[flask.request.cookies.get("auth")];
        #return {"username": "Reinhardt", "admin": True, 
        #        "courses": ["Technik", "Informatik"]};
    else:
        return flask.make_response("authorisation failed"), 401


@app.route("/move", methods=["POST"])
def move():
    global position;
    if checkAuth(flask.request.cookies.get("auth")):
        print(flask.request.get_json())
        position = flask.request.get_json()["position"];
        return flask.make_response("success");
    else:
        return flask.make_response("authorisation failed"), 401


@app.route("/entrys", methods=["POST"])
def entrys():
    if checkAuth(flask.request.cookies.get("auth")):
        r = requests.get("http://192.168.4.1/data")
        entrys = json.loads(r.text)["people"];
        print(entrys[0])
        new = [];
        for entry in entrys:
            new.append({
                "id": entry["number"],
                "name": entry["name"],
                "attendence": datetime.utcfromtimestamp(entry["attended"][-1][0]+946684800).strftime('%Y-%m-%d') if len(entry["attended"])>0 else "None",
                "balance": entry["time"]});
        return new;
    else:
        return flask.make_response("authorisation failed"), 401


@app.route("/courses", methods=["POST"])
def courses():
    if checkAuth(flask.request.cookies.get("auth")):
        return ["Technik", "Informatik", "Physik"];
    else:
        return flask.make_response("authorisation failed"), 401


@app.route("/student", methods=["POST"])
def student():
    if checkAuth(flask.request.cookies.get("auth")):
        pass
    else:
        return flask.make_response("authorisation failed"), 401

def getKey(e):
    return e["key"];
@app.route("/csv")#, methods=["POST"])
def csv():
    with open('exampledata.json', 'r') as file:
        data = file.read()
        entrys = json.loads(data)["people"]
    days = set()
    users = []
    for entry in entrys:
        users.append({"key": int(entry["number"]),"value": entry})
        for day in entry["attended"]:
            days.add(datetime.utcfromtimestamp(day[0]+946684800).strftime('%Y-%m-%d'))
    print(users)
    users.sort(key=getKey)
    print(users)
    with open('./students.csv', 'a', newline='') as csvfile:
        writer = csvBib.writer(csvfile, delimiter=' ',quotechar='|', quoting=csvBib.QUOTE_MINIMAL)
        header = ["Index", "Name"]
        header.append(days)
        writer.writerow(header)
        for user in users:
            print("x:" + str(user))
            line = (str(id), user["value"]['name'])
            writer.writerow(['Spam', 'Lovely Spam', 'Wonderful Spam'])
    return send_file("stundents.csv", as_attachment=True)

if __name__ == "__main__":
    app.run(port=8000)

