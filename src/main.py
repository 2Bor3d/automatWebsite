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


# IP = "http://192.168.4.1";


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
            logedin[random_bytes] = {"id": user["id"],
                                     "username": user["username"],
                                     "admin": user["admin"],
                                     "courses": courses_user,
                                     "position": "list",
                                     "sub": {}};
            response = flask.make_response("success", 200);
            response.set_cookie("auth", random_bytes);
            break;
    return response;


@app.route("/username", methods=["POST"])
def username():
    if checkAuth(flask.request.cookies.get("auth")):
        r = requests.get(IP + "/courses");
        courses_file = json.loads(r.text);

        courses_user = [];
        for course in courses_file.keys():
            if logedin[flask.request.cookies.get("auth")] \
                    in courses_file[course]["users"]:
                courses_user.append(course);

        logedin[flask.request.cookies.get("auth")]["courses"] = courses_user;

        return logedin[flask.request.cookies.get("auth")];
    else:
        return flask.make_response("authorisation failed"), 401


@app.route("/move", methods=["POST"])
def move():
    if checkAuth(flask.request.cookies.get("auth")):
        logedin[flask.request.cookies.get("auth")]["position"] = \
            flask.request.get_json()["position"];
        logedin[flask.request.cookies.get("auth")]["sub"] = \
            flask.request.get_json()["sub"];
        return flask.make_response("success");
    else:
        return flask.make_response("authorisation failed"), 401


@app.route("/entrys", methods=["POST"])
def entrys(raw=False):
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
            if raw:
                new.append({
                    "id": entry["number"],
                    "name": entry["name"],
                    "attendance": entry["attended"],
                    "balance": entry["time"]
                });
            else:
                new.append({
                    "id": entry["number"],
                    "name": entry["name"],
                    "attendence": datetime.utcfromtimestamp(entry["attended"][-1][0] + 946684800).strftime(
                        '%Y-%m-%d') if len(entry["attended"]) > 0 else "None",
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


@app.route("/add_user", methods=["POST"])
def add_user():
    if checkAuth(flask.request.cookies.get("auth")):
        if logedin[flask.request.cookies.get("auth")]:
            new = dict(flask.request.form);

            number = None;
            if new["rfid"] == "on":
                r = requests.get(IP + "/data");
                data = json.loads(r.text)["people"];

                number = 0;
                for person in data:
                    if person["number"] >= number:
                        number = person["number"] + 1;

                r = requests.post(IP + "/scan");
                rfid = r.text;

                card_type = {"admin": 0, "teacher": 1, "student": 2}[new["type"]];

                person = {"number": number,
                          "name": new["name"],
                          "type": card_type,
                          "rfid": rfid,
                          "attended": [],
                          "since": None,
                          "time": 0}
                data.append(person);

                r = requests.post(IP + "/change_user", json=data);

            if new["type"] != "student":
                r = requests.get(IP + "/users");
                users = json.loads(r.text);

                user_id = 0
                for user in users:
                    if user["id"] >= user_id:
                        user_id = user["id"] + 1

                admin = {"teacher": True, "admin": False}[new["type"]];

                user = {"id": user_id,
                        "username": new["mail"],
                        "password": new["password"],
                        "admin": admin,
                        "number": number}
                users.append(user);
                r = requests.post(IP + "/change_user_file", json=users);

                user = {};
            with open("addStudent/response/successNoCard.html", "r") as file:
                return file.read().replace("{user}", new["name"]);

    with open("addStudent/response/error.html", "r") as file:
        return file.read();


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

                if changes["date"] is not None:
                    if changes["attendance"] == "present":
                        data[i]["attended"] \
                            .append([int(changes["date"]) - 946684800]);
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


def inRange(fromm, to, x):
    if fromm == '':
        fromm = "0000-00-00";
    if to == '':
        to = "9999-99-99";
    if x == '':
        raise "x cant be null"
    fromm = str(fromm).split("-")
    to = str(to).split("-")
    x = str(x).split("-")
    if len(fromm) != 3 or len(to) != 3 or len(x) != 3:
        raise "Wrong format!";
    if int(fromm[0]) > int(x[0]):
        return False;
    elif int(fromm[1]) > int(x[1]):
        return False;
    elif int(fromm[2]) > int(x[2]):
        return False;

    if int(to[0]) < int(x[0]):
        return False;
    elif int(to[1]) < int(x[1]):
        return False;
    elif int(to[2]) < int(x[2]):
        return False;

    return True


@app.route("/csv", methods=["POST"])
def csv():  # TODO: use exact course -> Ben
    fromm = flask.request.form["from"]
    to = flask.request.form["to"]
    course = flask.request.form["course"]

    file_path = "students.csv"
    if os.path.exists(file_path):
        os.remove(file_path)
    days = set()
    users = []
    data = entrys(True)
    for entry in data:
        users.append({"key": int(entry["id"]), "value": entry})
        for day in entry["attendance"]:
            for x in day:
                if not inRange(fromm, to, datetime.utcfromtimestamp(x + 946684800).strftime('%Y-%m-%d')):
                    continue;
                days.add(datetime.utcfromtimestamp(x + 946684800).strftime('%Y-%m-%d'))

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
            for day in user["value"]['attendance']:
                for x in day:
                    if not inRange(fromm, to, datetime.utcfromtimestamp(x + 946684800).strftime('%Y-%m-%d')):
                        continue;
                    data.add(datetime.utcfromtimestamp(x + 946684800).strftime('%Y-%m-%d'))
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
