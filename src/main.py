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

IP = "http://127.0.0.1:5000";
#IP = "http://192.168.4.1";


def checkAuth(auth: str) -> bool:
    if auth in logedin:
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
    r = requests.get(IP + "/users");
    users = json.loads(r.text);
    print(users)

    r = requests.get(IP + "/courses");
    courses_file = json.loads(r.text);

    response = flask.make_response("wrong username or password", 401)
    for user in users:
        if user["username"] == attempt["username"] and user["password"] == attempt["password"]:
            courses_user = [];
            for course in courses_file.keys():
                if user["id"] in courses_file[course]["users"]:
                    courses_user.append(course);
            random_bytes = base64.b64encode(os.urandom(32)).decode("utf-8");
            ############################################# fails 1/1431655765 times
            logedin[random_bytes] = {"username": user["username"], "admin": user["admin"], "courses": courses_user, "position": "list", "sub": {}};
            response = flask.make_response("success", 200);
            response.set_cookie("auth", random_bytes);
            break;
    return response;


@app.route("/username", methods=["POST"])
def username():
    if checkAuth(flask.request.cookies.get("auth")):
        return logedin[flask.request.cookies.get("auth")];
    else:
        return flask.make_response("authorisation failed"), 401


@app.route("/move", methods=["POST"])
def move():
    if checkAuth(flask.request.cookies.get("auth")):
        print(flask.request.get_json())
        logedin[flask.request.cookies.get("auth")]["position"] = \
            flask.request.get_json()["position"];
        logedin[flask.request.cookies.get("auth")]["sub"] = \
            flask.request.get_json()["sub"];
        return flask.make_response("success");
    else:
        return flask.make_response("authorisation failed"), 401


@app.route("/entrys", methods=["POST"])
def entrys():
    if checkAuth(flask.request.cookies.get("auth")):
        r = requests.get(IP + "/data");
        entrys = json.loads(r.text)["people"];

        user = logedin[flask.request.cookies.get("auth")];
        if not user["admin"] or user["sub"] != {}:
            r = requests.get(IP + "/courses");
            courses = json.loads(r.text);
            students = set({});
            print(user)
            print("--")
            if user["sub"] == {}:
                for cours in user["courses"]:
                    students = students.union(set(courses[cours]["students"]));
            else:
                students = set(courses[user["sub"]["course"]]["students"]);

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
                "attendence": datetime.utcfromtimestamp(entry["attended"][-1][0] + 946684800).strftime('%Y-%m-%d') if len(entry["attended"])>0 else "None",
                "balance": entry["time"]});
        return new;
    else:
        return flask.make_response("authorisation failed"), 401


@app.route("/courses", methods=["POST"])
def courses():
    if checkAuth(flask.request.cookies.get("auth")):
        if logedin[flask.request.cookies.get("auth")]["admin"]:
            r = requests.get(IP + "/courses");
            return r.text;
    return flask.make_response("authorisation failed"), 401


# @app.route("/student", methods=["POST"]) #TODO: remove if no use is found
def student():
    if checkAuth(flask.request.cookies.get("auth")):
        r = requests.get(IP + "/students?course=forschen");
        print(r)
        print(r.text)
        print(json.loads(r.text))
    else:
        return flask.make_response("authorisation failed"), 401


@app.route("/change_user", methods=["POST"])
def change_user():
    if checkAuth(flask.request.cookies.get("auth")):
        r = requests.get(IP + "/data");
        data = json.loads(r.text)["people"];
        changes = flask.request.get_json();
        for i in range(len(data)):
            if data[i]["number"] == int(changes["id"]):
                if logedin[flask.request.cookies.get("auth")]["admin"]:
                    data[i]["name"] = changes["name"];
                data[i]["time"] = changes["balance"];
        r = requests.post(IP + "/change_user", json=data);
    return "fail"


@app.route("/delete_user", methods=["POST"])
def delete_user():
    if checkAuth(flask.request.cookies.get("auth")):
        if logedin[flask.request.cookies.get("auth")]["admin"]:
            print(flask.request.json)
            r = requests.get(IP + "/data");
            data = json.loads(r.text)["people"];
            user = flask.request.get_json()["id"];

            for i in range(len(data)):
                if data[i]["number"] == int(user):
                    data.pop(i);
                    break;
            r = requests.post(IP + "/change_user", json=data);
            return "success"
    return "fail"


@app.route("/get_users", methods=["POST"])
def get_users():
    if checkAuth(flask.request.cookies.get("auth")):
        if logedin[flask.request.cookies.get("auth")]["admin"]:
            r = requests.get(IP + "/users");
            users = json.loads(r.text);
            return users;
    return "fail";


@app.route("/add_course", methods=["POST"])
def add_course():
    if checkAuth(flask.request.cookies.get("auth")):
        if logedin[flask.request.cookies.get("auth")]["admin"]:
            r = requests.get(IP + "/courses");
            courses = json.loads(r.text);
            changes = dict(flask.request.form)

            courses[changes["name"]] = {"day": int(changes["day"]),
                                        "students": [],
                                        "users": [int(changes["user"])]}
            r = requests.post(IP + "/change_course", json=courses);
            return "success";
    return "fail";


@app.route("/change_course", methods=["POST"])
def change_course():
    if checkAuth(flask.request.cookies.get("auth")):
        if logedin[flask.request.cookies.get("auth")]["admin"]:
            r = requests.get(IP + "/courses");
            courses = json.loads(r.text);
            changes = flask.request.get_json();

            courses[changes["name"]] = courses.pop(changes["old"]);
            courses[changes["name"]]["day"] = changes["day"];
            courses[changes["name"]]["students"] = [];
            for student in changes["students"].split(","):
                courses[changes["name"]]["students"].append(int(student));
            courses[changes["name"]]["users"] = [];
            for user in changes["users"].split(","):
                courses[changes["name"]]["users"].append(int(user));
            r = requests.post(IP + "/change_course", json=courses);
    return "fail"


@app.route("/delete_course", methods=["POST"])
def delete_course():
    if checkAuth(flask.request.cookies.get("auth")):
        if logedin[flask.request.cookies.get("auth")]["admin"]:
            r = requests.get(IP + "/courses");
            courses = json.loads(r.text);
            course = flask.request.get_json()["id"];

            courses.pop(course);

            r = requests.post(IP + "/change_course", json=courses);
            return "success";
    return "fail";


@app.route("/csv")#, methods=["POST"])
def csv():
    file_path = "students.csv"
    if os.path.exists(file_path):
        os.remove(file_path)

    days = set()
    users = []

    with open('exampledata.json', 'r') as json_file:#TODO: add ability to change file used for sending data
        data = json_file.read()
        for entry in json.loads(data)["people"]:
            users.append({"key": int(entry["number"]),"value": entry})
            for day in entry["attended"]:
                for x in day:
                    days.add(datetime.utcfromtimestamp(int(x) + 946684800).strftime('%Y-%m-%d'))

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
                    data.add(datetime.utcfromtimestamp(x + 946684800).strftime('%Y-%m-%d'))
            line = (str(user["key"]), user["value"]['name'])
            for day in days:
                if day in data:
                    line += ("Ja",)
                else:
                    line += ("Nein",)
            writer.writerow(line)

    return send_file("students.csv", as_attachment=True)


# @app.route("/add_user", methods=["POST"])
def add_user():
    try:
        rfid = "rfid" in flask.request.form.keys()
        username = flask.request.form["name"]
        usertype = flask.request.form["type"]
        if usertype == "teacher" or usertype == "admin":
            mail = flask.request.form["mail"]
            password = flask.request.form["password"]
            if password == "" or mail == "":
                return "response: 235"
    except Exception as e:
        with open("addStudent/response/error.html", "r") as file:
            return file.read()
    #TODO: addStudent user to database
    if rfid:
        with open("addStudent/response/successCard.html", "r") as file:
            return file.read()
    else:
        with open("addStudent/response/successNoCard.html", "r") as file:
            return file.read().replace("{user}", username)


@app.route("/add_user", methods=["POST"])
def add_user():  # davids version
    print(flask.request.form)


# @app.route("/add_course", methods=["POST"])
def add_course():
    try:
        name = flask.request.form["name"]
        day = flask.request.form["day"]
        lehrer = flask.request.form["lehrer"]
    except Exception as e:
        with open("addCourse/response/error.html", "r") as file:
            return file.read()
    #TODO: add course to database
    with open("addCourse/response/success.html" , "r") as file:
        return file.read().__str__().replace("{kurs}", name).replace("{day}", day).replace("{lehrer}", lehrer)


if __name__ == "__main__":
    app.run(port=8080)
