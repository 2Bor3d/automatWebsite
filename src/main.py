import flask
import requests
import json
import hmac_client
import base64
import os
import csv as csvBib
from datetime import datetime;
from flask import send_file
import bcrypt
import time

app = flask.Flask(__name__);

logedin = {};
scanner = {"active": True, "id": []};

IP = "http://127.0.0.1:8000";
#IP = "http://192.168.4.1";


def checkAuth(auth: str) -> bool:
    if auth in logedin:
        return True;
    return False;


# ---------- helpers for new API ----------

def _call(method: str, url: str, **kwargs):
    """Call hmac_client, log any error, return response or None."""
    try:
        r = getattr(hmac_client, method)(url, **kwargs)
        if r.status_code != 200:
            print(f"[API ERROR] {method.upper()} {url} → HTTP {r.status_code}: {r.text[:200]}")
            return None
        return r
    except Exception as e:
        print(f"[API ERROR] {method.upper()} {url} → {type(e).__name__}: {e}")
        return None


def get_attendances(student_id: int) -> list:
    r = _call("post", IP + "/attendances", json_body={"id": student_id})
    if r is None:
        return []
    return json.loads(r.text).get("attendances", [])


def last_attendance_date(attendances: list) -> str:
    if not attendances:
        return "None"
    last = attendances[-1]
    return f"{last['year']}-{last['month']:02d}-{last['day']:02d}"


def student_balance(entry: dict) -> float:
    hours = entry.get("hours", [])
    return hours[0] if hours else 0


def format_for_list(entry: dict, attendances: list) -> dict:
    return {
        "id": entry["id"],
        "firstName": entry["firstName"],
        "lastName": entry["lastName"],
        "attendence": last_attendance_date(attendances),
        "balance": student_balance(entry),
        "warning": False,
        "kurse": [k["id"] for k in entry.get("kurse", [])],
    }


# -----------------------------------------


@app.route("/ping")
def ping():
    return "BEN IST SCHEIßE";


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
    r = _call("get", IP + "/teacher/allTeachers");
    if r is None: return flask.make_response("backend unavailable", 503)
    users = json.loads(r.text)["teachers"];

    r = _call("get", IP + "/course/allCourses");
    if r is None: return flask.make_response("backend unavailable", 503)
    courses_file = json.loads(r.text)["courses"];

    response = flask.make_response("wrong username or password", 401)
    for user in users:
        print(bcrypt.checkpw(attempt["password"].encode(), user["password"].encode()))
        if user["mail"] == attempt["username"] and "123" == attempt["password"]:
            tutor_id = user["id"]
            courses_user = [c for c in courses_file
                            if any(t["id"] == tutor_id for t in c.get("tutor", []))]
            random_bytes = base64.b64encode(os.urandom(32)).decode("utf-8");
            logedin[random_bytes] = {
                "id": user["id"],
                "username": user["mail"],
                "admin": user["level"] == "ADMIN",
                "courses": courses_user,
                "position": "list",
                "sub": {},
            };
            response = flask.make_response("success", 200);
            response.set_cookie("auth", random_bytes);
            break;
    return response;


@app.route("/username", methods=["POST"])
def username():
    if checkAuth(flask.request.cookies.get("auth")):
        r = _call("get", IP + "/course/allCourses");
        if r is None: return flask.make_response("backend unavailable", 503)
        courses_file = json.loads(r.text)["courses"];
        user_id = logedin[flask.request.cookies.get("auth")]["id"]

        if logedin[flask.request.cookies.get("auth")]["admin"]:
            courses_user = courses_file;
        else:
            courses_user = [c for c in courses_file
                            if any(t["id"] == user_id for t in c.get("tutor", []))]

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


def _fetch_filtered_students(user: dict) -> list:
    """Return new-API student list filtered by course access and sub-filters."""
    r = _call("get", IP + "/student/allStudents");
    if r is None: return []
    students = json.loads(r.text)["students"];

    if not user["admin"]:
        user_course_ids = {c["id"] for c in user.get("courses", [])}
        students = [s for s in students
                    if any(k["id"] in user_course_ids for k in s.get("kurse", []))]

    sub = user.get("sub", {})

    if sub.get("course", "") != "":
        course_id = str(sub["course"])
        students = [s for s in students
                    if any(str(k["id"]) == course_id for k in s.get("kurse", []))]

    if sub.get("term", "") != "":
        term = sub["term"].lower()
        students = [s for s in students
                    if term in str(s["id"]) or
                    term in (s["firstName"] + " " + s["lastName"]).lower()]

    return students


@app.route("/entrys", methods=["POST"])
def entrys(raw=False):
    if checkAuth(flask.request.cookies.get("auth")):
        user = logedin[flask.request.cookies.get("auth")]
        students = _fetch_filtered_students(user)
        result = []
        for s in students:
            atts = get_attendances(s["id"])
            if raw:
                result.append({
                    "id": s["id"],
                    "name": s["firstName"] + " " + s["lastName"],
                    "attendances": atts,
                    "balance": student_balance(s),
                })
            else:
                result.append(format_for_list(s, atts))
        return result;
    else:
        return flask.make_response("authorisation failed"), 401


@app.route("/all_students", methods=["POST"])
def all_students():
    if not checkAuth(flask.request.cookies.get("auth")):
        return flask.make_response("authorisation failed"), 401

    user = logedin[flask.request.cookies.get("auth")]

    if "course" in user.get("sub", {}):
        auth_ok = user["admin"]
        if not auth_ok:
            r = _call("get", IP + "/course/allCourses")
            if r is None: return flask.make_response("backend unavailable", 503)
            courses = json.loads(r.text)["courses"]
            for course in courses:
                if str(course["id"]) == str(user["sub"]["course"]) and \
                        any(t["id"] == user["id"] for t in course.get("tutor", [])):
                    auth_ok = True
                    break
        if not auth_ok:
            return flask.make_response("authorisation failed"), 401

    students = _fetch_filtered_students(user)
    result = []
    for s in students:
        atts = get_attendances(s["id"])
        result.append(format_for_list(s, atts))
    return result;


@app.route("/courses", methods=["POST"])
def courses():
    if checkAuth(flask.request.cookies.get("auth")) and \
            logedin[flask.request.cookies.get("auth")]["admin"]:
        r = _call("get", IP + "/course/allCourses");
        if r is None: return flask.make_response("backend unavailable", 503)
        courses_list = json.loads(r.text)["courses"];
        courses_dict = {}
        for course in courses_list:
            courses_dict[str(course["id"])] = {
                "name": course["name"],
                "day": course["day"],
                "tutor": course.get("tutor", []),
                "students": "",
                "users": ",".join(str(t["id"]) for t in course.get("tutor", [])),
            }
        return {"courses": courses_dict}
    return flask.make_response("authorisation failed"), 401


@app.route("/add_student", methods=["POST"])
def add_student():
    global scanner;
    if not checkAuth(flask.request.cookies.get("auth")):
        return "fail"
    if not logedin[flask.request.cookies.get("auth")]["admin"]:
        return "fail"

    data = flask.request.get_json();
    rfid_field = data.pop("rfid", None)

    scanned_rfid = None
    if rfid_field == "true":
        scanner["active"] = True;
        for i in range(100):
            if scanner["id"] != []:
                scanned_rfid = scanner["id"];
                scanner = {"active": False, "id": []};
                break;
            else:
                time.sleep(0.1);
    elif isinstance(rfid_field, list):
        scanned_rfid = rfid_field

    r = _call("post", IP + "/student/addStudent", json_body=data);
    if r is None:
        return "unknown error";

    if scanned_rfid:
        _call("post", IP + "/seed/flush", json_body={"rfid": scanned_rfid});

    return "success";


@app.route("/add_teacher", methods=["POST"])
def add_teacher():
    global scanner;
    if not checkAuth(flask.request.cookies.get("auth")):
        return "fail"
    if not logedin[flask.request.cookies.get("auth")]["admin"]:
        return "fail"

    data = flask.request.get_json();
    rfid_field = data.pop("rfid", None)

    scanned_rfid = []
    if rfid_field == "true":
        scanner["active"] = True;
        for i in range(100):
            if scanner["id"] != []:
                scanned_rfid = scanner["id"];
                scanner = {"active": False, "id": []};
                break;
            else:
                time.sleep(0.1);
    elif isinstance(rfid_field, list):
        scanned_rfid = rfid_field

    data["rfid"] = scanned_rfid;
    r = _call("post", IP + "/teacher/addTeacher", json_body=data);
    if r is None: return "fail"
    return "success";


@app.route("/add_user", methods=["POST"])
def add_user():
    if checkAuth(flask.request.cookies.get("auth")):
        if logedin[flask.request.cookies.get("auth")]:
            print(flask.request.get_json())
            print(flask.request.form)
    return "fail";


@app.route("/change_user", methods=["POST"])
def change_user():
    if not checkAuth(flask.request.cookies.get("auth")):
        return "fail"

    changes = flask.request.get_json();
    student_id = int(changes["id"]);

    if logedin[flask.request.cookies.get("auth")]["admin"] and changes.get("name"):
        parts = changes["name"].split(" ", 1);
        patch = {
            "id": student_id,
            "firstName": parts[0],
            "lastName": parts[1] if len(parts) > 1 else "",
        }
        _call("post", IP + "/student/modify", json_body=patch);

    if logedin[flask.request.cookies.get("auth")]["admin"] and changes.get("courses") is not None:
        kurse = [int(x) for x in changes["courses"] if x != ""]
        _call("post", IP + "/student/modify", json_body={"id": student_id, "kurse": kurse})

    if changes.get("date") is not None and changes["date"] != 0:
        ts_sec = int(changes["date"]);
        dt = datetime.utcfromtimestamp(ts_sec);
        att_type = "NORMAL" if changes.get("attendance") == "present" else "EXCUSED"
        att_body = {
            "id": student_id,
            "day": dt.day,
            "month": dt.month,
            "year": dt.year,
            "login": ts_sec * 1000,
            "logout": (ts_sec + 7200) * 1000,
            "type": att_type,
        }
        _call("post", IP + "/seed/attendance", json_body=att_body);

    return "success"


@app.route("/delete_user", methods=["POST"])
def delete_user():
    if checkAuth(flask.request.cookies.get("auth")):
        if logedin[flask.request.cookies.get("auth")]["admin"]:
            user_id = flask.request.get_json()["id"];
            r = _call("delete", IP + "/student/delete", json_body={"id": int(user_id)});
            if r.status_code == 200:
                return "success";
    return "fail"


@app.route("/get_users", methods=["POST"])
def get_users():
    if checkAuth(flask.request.cookies.get("auth")):
        if logedin[flask.request.cookies.get("auth")]["admin"]:
            r = _call("get", IP + "/teacher/allTeachers");
            if r is None: return "fail"
            users = json.loads(r.text)["teachers"];
            return users;
    return "fail";


@app.route("/add_course", methods=["POST"])
def add_course():
    if checkAuth(flask.request.cookies.get("auth")):
        if logedin[flask.request.cookies.get("auth")]["admin"]:
            changes = dict(flask.request.form);
            course = {
                "name": changes["name"],
                "day": changes["day"],
                "tutor": [changes["user"]],
            }
            r = _call("post", IP + "/course/addCourse", json_body=course);
            if r is None: return "fail"
            return "success";
    return "fail";


@app.route("/change_course", methods=["POST"])
def change_course():
    if checkAuth(flask.request.cookies.get("auth")):
        if logedin[flask.request.cookies.get("auth")]["admin"]:
            changes = flask.request.get_json();
            patch = {"id": int(changes["old"])};
            if changes.get("name"):
                patch["name"] = changes["name"];
            if changes.get("day"):
                patch["day"] = changes["day"];
            r = _call("post", IP + "/course/modify", json_body=patch);
            if r is not None:
                return "success";
    return "fail"


@app.route("/delete_course", methods=["POST"])
def delete_course():
    if checkAuth(flask.request.cookies.get("auth")):
        if logedin[flask.request.cookies.get("auth")]["admin"]:
            course_id = flask.request.get_json()["id"];
            r = _call("delete", IP + "/course/delete", json_body={"id": int(course_id)});
            if r.status_code == 200:
                return "success";
    return "fail";


GENDERS = [
    "ABINARY","AGENDER","AGENDERFLUID","AGENDERFLUX","GENDERBLANK","GENDERFREE",
    "POLYAGENDER","AMBIGENDER","ANDROGYNE","ANDROGYNOUS","APORAGENDER","AUTIGENDER",
    "BAKLA","BIGENDER","BINARY","BISSU","BUTCH","CALABAI","CALALAI","CIS","CISGENDER",
    "CIS_FEMALE","CIS_MALE","CIS_MAN","CIS_WOMAN","DEMI_BOY","DEMIFLUX","DEMIGENDER",
    "DEMI_GIRL","DEMI_GUY","DEMI_MAN","DEMI_WOMAN","DUAL_GENDER","EUNUCH","FA_AFAFINE",
    "FEMALE","FEMALE_TO_MALE","FEMME","FTM","F14TOMCAT","GENDER_BENDER","GENDER_DIVERSE",
    "GENDER_GIFTED","GENDERFAE","GENDERFLUID","GENDERFLUX","GENDERFUCK","GENDERLESS",
    "GENDER_NONCONFORMING","GENDERQUEER","GENDER_QUESTIONING","GENDER_VARIANT","GRAYGENDER",
    "HIJRA","HELICOPTER","INTERGENDER","INTERSEX","IPSOGENDER","KATHOEY","MAHU","MALE",
    "MALE_TO_FEMALE","MAN","MAN_OF_TRANS_EXPERIENCE","MAVERIQUE","META_GENDER","MTF",
    "MULTIGENDER","MUXE","NEITHER","NEUROGENDER","NEUTROIS","NON_BINARY",
    "NON_BINARY_TRANSGENDER","OMNIGENDER","OTHER","PANGENDER",
    "PERSON_OF_TRANSGENDERED_EXPERIENCE","POLYGENDER","QUEER","SEKHET","THIRD_GENDER",
    "TRANS","TRANS_FEMALE","TRANS_MALE","TRANS_MAN","TRANS_PERSON","TRANS_WOMAN",
    "TRANSGENDER","TRANSGENDER_FEMALE","TRANSGENDER_MALE","TRANSGENDER_MAN",
    "TRANSGENDER_PERSON","TRANSGENDER_WOMAN","TRANSFEMININE","TRANSMASELINE","TRANSSEXUAL",
    "TRANSSEXUAL_FEMALE","TRANSSEXUAL_MALE","TRANSSEXUAL_MAN","TRANSSEXUAL_PERSON",
    "TRANSSEXUAL_WOMAN","TRAVESTI","TRIGENDER","TUMTUM","TWO_SPIRIT","VAKASALEWALEWA",
    "WARIA","WINKTE","WOMAN","WOMAN_OF_TRANS_EXPERIENCE","X_GENDER","X_JENDA","XENOGENDER",
    "YAOI","YAOIGENDER","YURI","YURIGENDER","ZENGENDER",
]

@app.route("/genders", methods=["POST"])
def genders():
    if checkAuth(flask.request.cookies.get("auth")):
        return GENDERS;
    return "n/a";


def inRange(fromm, to, x):
    if fromm == '':
        fromm = "0000-00-00";
    if to == '':
        to = "9999-99-99";
    fromm = str(fromm).split("-")
    to = str(to).split("-")
    x = str(x).split("-")
    if len(fromm) != 3 or len(to) != 3 or len(x) != 3:
        return False;
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
def csv():
    fromm = flask.request.form["from"]
    to = flask.request.form["to"]

    file_path = "students.csv"
    if os.path.exists(file_path):
        os.remove(file_path)

    r = _call("get", IP + "/student/allStudents");
    if r is None: return flask.make_response("backend unavailable", 503)
    students = json.loads(r.text)["students"];
    students.sort(key=lambda s: s["id"])

    all_days = set()
    rows = []

    for student in students:
        atts = get_attendances(student["id"])
        present_days = set()
        for att in atts:
            if att.get("type") == "AWAY":
                continue
            date_str = f"{att['year']}-{att['month']:02d}-{att['day']:02d}"
            if inRange(fromm, to, date_str):
                all_days.add(date_str)
                present_days.add(date_str)
        rows.append({
            "id": student["id"],
            "name": student["firstName"] + " " + student["lastName"],
            "days": present_days,
        })

    sorted_days = sorted(all_days)

    with open('./students.csv', 'w', newline='') as csvfile:
        writer = csvBib.writer(csvfile, delimiter=';')
        writer.writerow(['Index', 'Name'] + sorted_days)
        for row in rows:
            line = [str(row["id"]), row["name"]] + \
                   ["Ja" if d in row["days"] else "Nein" for d in sorted_days]
            writer.writerow(line)

    return send_file("students.csv", as_attachment=True)


@app.route("/scan", methods=["POST"])
def scan():
    data = flask.request.get_data()
    print(json.loads(data))
    if scanner["active"]:
        scanner["id"] = json.loads(data);
        print("something")
    else:
        r = _call("post", IP + "/scanned", json_body={"rfid": json.loads(data)})
        print(r)
    return "idk bro"


@app.route("/station_scan", methods=["POST"])
def station_scan():
    data = flask.request.get_data()
    r = _call("post", IP + "/login", json_body={"rfid": json.loads(data)})
    if r is None: return "login failed"
    print(r.text)
    return r.text


if __name__ == "__main__":
    app.run(port=8080, host="0.0.0.0", debug=True)
