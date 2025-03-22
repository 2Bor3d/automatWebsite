from pathlib import Path

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
        position = logedin[flask.request.cookies.get("auth")]["position"];
        with open(f"{position}/index.html", "r") as file:
            return file.read();
    else:
        return flask.make_response("authorisation failed"), 401


@app.route("/page/script.js")
def pageJs():
    if checkAuth(flask.request.cookies.get("auth")):
        position = logedin[flask.request.cookies.get("auth")]["position"];
        with open(f"{position}/script.js", "r") as file:
            return file.read();
    else:
        return flask.make_response("authorisation failed"), 401


@app.route("/page/styles.css")
def pageCss():
    if checkAuth(flask.request.cookies.get("auth")):
        position = logedin[flask.request.cookies.get("auth")]["position"];
        with open(f"{position}/styles.css", "r") as file:
            return flask.Response(file.read(), mimetype="text/css");
    else:
        return flask.make_response("authorisation failed"), 401


@app.route("/login", methods=["POST"])
def login():
    attempt = flask.request.get_json();
    print("---")
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
            logedin[random_bytes] = {"username": user["username"], "admin": user["admin"], "courses": user["groups"], "position": "list", "sub": ""};
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
        r = requests.get("http://192.168.4.1/data");
        entrys = json.loads(r.text)["people"];

        user = logedin[flask.request.cookies.get("auth")];
        if not user["admin"] or user["sub"] != "":
            r = requests.get("http://192.168.4.1/courses");
            courses = json.load(r.text);
            students = {};
            if user["sub"] == "":
                for cours in user["courses"]:
                    students = students + set(courses[cours]["students"]);
            else:
                students = set(courses[user["sub"]]["students"]);

            cleaned = [];
            for entry in entrys:
                if entry["number"] in students:
                    cleaned.append(entry);
            entrys = cleaned;

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
        r = requests.get("http://192.168.4.1/students?course=forschen");
        print(r)
        print(r.text)
        print(json.loads(r.text))
    else:
        return flask.make_response("authorisation failed"), 401

#TODO: add ability to change file used for sending data
@app.route("/csv")#, methods=["POST"])
def csv():
    file_path = "students.csv"
    if os.path.exists(file_path):
        os.remove(file_path)

    days = set()
    users = []

    with open('exampledata.json', 'r') as json_file:
        data = json_file.read()
        for entry in json.loads(data)["people"]:
            users.append({"key": int(entry["number"]),"value": entry})
            for day in entry["attended"]:
                for x in day:
                    days.add(datetime.utcfromtimestamp(int(x)+946684800).strftime('%Y-%m-%d'))

    users.sort(key=lambda x: x["key"])

    with open('./students.csv', 'a', newline='') as csvfile:
        writer = csvBib.writer(csvfile, delimiter=';')
        header = ['Index', 'Name']
        for day in days:
            header.append(day)
        writer.writerow(header)
        print(days)

        for user in users:
            data = set()
            for day in user["value"]['attended']:
                for x in day:
                    data.add(datetime.utcfromtimestamp(x+946684800).strftime('%Y-%m-%d'))
            line = (str(user["key"]), user["value"]['name'])
            for day in days:
                if day in data:
                    line += ("Ja",)
                else:
                    line += ("Nein",)
            writer.writerow(line)

    return send_file("students.csv", as_attachment=True)

if __name__ == "__main__":
    app.run(port=8080)
