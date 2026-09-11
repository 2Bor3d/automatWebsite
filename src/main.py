import flask
import requests
import json
import hmac_client
import base64
import os
import csv as csvBib
from datetime import datetime, date as Date, timedelta
from flask import send_file
import bcrypt
import time

app = flask.Flask(__name__);

logedin = {};
scanner = {"active": False, "id": []};

# Wartezeit auf einen Kartenscan beim Anlegen: 100 * 0.1s = 10 Sekunden.
SCAN_TIMEOUT_STEPS = 100;

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


ATTENDANCE_STATUS = {"NORMAL": "normal", "EXCUSED": "excused", "AWAY": "absent"}


def day_statuses(attendances: list) -> dict:
    """{ "YYYY-MM-DD": "normal" | "excused" | "absent" } - pro Tag zählt der
    zuletzt angelegte Eintrag. Ältere Daten enthalten mehrere Einträge für
    denselben Tag (früher wurde beim Umstellen ergänzt statt ersetzt); der
    neueste ist die letzte Änderung."""
    result = {}
    for a in sorted(attendances, key=lambda a: a.get("id") or 0):
        status = ATTENDANCE_STATUS.get(a.get("type", ""))
        if status:
            result[f"{a['year']}-{a['month']:02d}-{a['day']:02d}"] = status
    return result


def last_attendance_date(attendances: list) -> str:
    present = [d for d, s in day_statuses(attendances).items() if s == "normal"]
    return max(present) if present else "None"


def student_balance(entry: dict) -> float:
    hours = entry.get("hours", [])
    return hours[0] if hours else 0


# Kurs.day (Java) -> Python date.weekday() (Montag=0 .. Sonntag=6). Reihenfolge
# entspricht dem Ordinal des Day-Enums, siehe Day.java.
DAY_TO_WEEKDAY = {
    "MONDTAG": 0, "DEINSTAG": 1, "METTWOCH": 2, "DÖNNERSTAG": 3,
    "REINTAG": 4, "SAUFTAG": 5, "SONNDAG": 6,
}


def recent_attendance(attendances: list, kurse: list) -> list:
    # Zeigt die letzten 7 tatsächlichen Kurstermine (Wochentage der belegten
    # Kurse), nicht die letzten 7 Kalendertage - sonst tauchen kursfreie Tage
    # als "none" auf und echte Fehltage rutschen aus dem Fenster.
    weekdays = {DAY_TO_WEEKDAY[k["day"]] for k in kurse if k.get("day") in DAY_TO_WEEKDAY}

    today = Date.today()
    dates = []
    d = today
    while len(dates) < 7:
        if not weekdays or d.weekday() in weekdays:
            dates.append(d)
        d -= timedelta(days=1)
    dates.reverse()

    statuses = day_statuses(attendances)
    result = []
    for d in dates:
        key = f"{d.year}-{d.month:02d}-{d.day:02d}"
        # Ein vergangener Kurstermin ohne jeden Eintrag heißt: nicht da gewesen.
        # Nur der heutige Termin bleibt neutral, solange noch niemand gescannt
        # hat - der Kurs kann ja noch bevorstehen.
        default = "none" if d >= today else "absent"
        result.append({"date": key, "status": statuses.get(key, default)})
    return result


def format_for_list(entry: dict, attendances: list) -> dict:
    kurse = entry.get("kurse", [])
    return {
        "id": entry["id"],
        "firstName": entry["firstName"],
        "lastName": entry["lastName"],
        "attendence": last_attendance_date(attendances),
        "balance": student_balance(entry),
        "warning": False,
        "kurse": [k["id"] for k in kurse],
        "gender": entry.get("gender", ""),
        "birthday": entry.get("birthday", 0),
        "rfid": entry.get("rfid", []),
        "wohnort": entry.get("wohnort", {}),
        "recent_days": recent_attendance(attendances, kurse),
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
        pw_ok = bcrypt.checkpw(attempt["password"].encode(), user["password"].encode())
        if user["mail"] == attempt["username"] and pw_ok:
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
        body = flask.request.get_json()
        logedin[flask.request.cookies.get("auth")]["position"] = body["position"]
        logedin[flask.request.cookies.get("auth")]["sub"] = body.get("sub", {})
        return flask.make_response("success");
    else:
        return flask.make_response("authorisation failed"), 401


@app.route("/view_as", methods=["POST"])
def view_as():
    token = flask.request.cookies.get("auth")
    if not checkAuth(token):
        return flask.make_response("authorisation failed"), 401

    session = logedin[token]
    # realAdmin ist nur gesetzt, sobald man schon einmal "view as" genutzt hat -
    # vorher spiegelt "admin" selbst den echten Login wieder.
    if not session.get("realAdmin", session["admin"]):
        return flask.make_response("forbidden"), 403

    body = flask.request.get_json()
    teacher_id = body.get("teacherId")

    r = _call("get", IP + "/teacher/allTeachers")
    if r is None: return flask.make_response("backend unavailable", 503)
    teachers = json.loads(r.text)["teachers"]
    teacher = next((t for t in teachers if str(t["id"]) == str(teacher_id)), None)
    if teacher is None:
        return flask.make_response("teacher not found"), 404

    if "realId" not in session:
        session["realId"] = session["id"]
        session["realUsername"] = session["username"]
        session["realAdmin"] = session["admin"]

    session["id"] = teacher["id"]
    session["username"] = teacher["mail"]
    session["admin"] = False
    session["viewAsName"] = f"{teacher['firstName']} {teacher['lastName']}"
    session["position"] = "list"
    session["sub"] = {}
    return flask.make_response("success")


@app.route("/view_as_stop", methods=["POST"])
def view_as_stop():
    token = flask.request.cookies.get("auth")
    if not checkAuth(token):
        return flask.make_response("authorisation failed"), 401

    session = logedin[token]
    if "realId" not in session:
        return flask.make_response("success")

    session["id"] = session.pop("realId")
    session["username"] = session.pop("realUsername")
    session["admin"] = session.pop("realAdmin")
    session.pop("viewAsName", None)
    session["position"] = "list"
    session["sub"] = {}
    return flask.make_response("success")


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


def is_tutor_of_student(user: dict, student_id: int) -> bool:
    """True if the user leads at least one course this student attends.

    Kursleitungen dürfen Anwesenheit und Zeitkonto ihrer eigenen Teilnehmenden
    pflegen - Stammdaten (Name, Kurse, Adresse, Chipkarte) bleiben Admins
    vorbehalten.
    """
    r = _call("get", IP + "/student/allStudents")
    if r is None:
        return False
    student = next((s for s in json.loads(r.text)["students"] if s["id"] == student_id), None)
    if student is None:
        return False

    student_course_ids = {k["id"] for k in student.get("kurse", [])}

    r = _call("get", IP + "/course/allCourses")
    if r is None:
        return False
    for course in json.loads(r.text)["courses"]:
        if course["id"] in student_course_ids and \
                any(t["id"] == user["id"] for t in course.get("tutor", [])):
            return True
    return False


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
                "participants": [],
                "users": ",".join(str(t["id"]) for t in course.get("tutor", [])),
            }

        r2 = _call("get", IP + "/student/allStudents")
        if r2 is not None:
            for s in json.loads(r2.text)["students"]:
                for k in s.get("kurse", []):
                    cid = str(k["id"])
                    if cid in courses_dict:
                        courses_dict[cid]["participants"].append({
                            "id": s["id"],
                            "firstName": s["firstName"],
                            "lastName": s["lastName"],
                        })

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

    if rfid_field == "false":
        # Ohne Chipkarte sofort anlegen. Bewusst NICHT über die Warteschlange:
        # /seed/flush nimmt immer den ältesten Eintrag und würde damit einem
        # anderen, auf seine Karte wartenden Schüler die Anmeldung wegnehmen.
        r = _call("post", IP + "/student/addWithoutCard", json_body=data);
        return "success" if r is not None else "unknown error";

    # Mit Chipkarte: nur vormerken. /student/addStudent legt noch nichts an,
    # sondern hängt den Schüler in die Warteschlange des Backends. Angelegt wird
    # er erst, wenn am Automaten ("Nutzer hinzufügen") seine Karte gescannt wird.
    r = _call("post", IP + "/student/addStudent", json_body=data);
    if r is None:
        return "unknown error";
    return "queued";


IMPORT_TEMPLATE = (
    "Vorname;Nachname;Geburtstag;Geschlecht;Straße;Nr;PLZ;Stadt;Land;Kurs\r\n"
    "Anna;Beispiel;03.04.2012;w;Hauptstraße;5;64342;Seeheim-Jugenheim;Deutschland;\r\n"
)


@app.route("/import_template")
def import_template():
    if not checkAuth(flask.request.cookies.get("auth")):
        return flask.make_response("authorisation failed"), 401
    # BOM, damit Excel die Umlaute als UTF-8 erkennt.
    response = flask.make_response("﻿" + IMPORT_TEMPLATE)
    response.headers["Content-Type"] = "text/csv; charset=utf-8"
    response.headers["Content-Disposition"] = "attachment; filename=schuelerliste_vorlage.csv"
    return response


@app.route("/import_students", methods=["POST"])
def import_students():
    """Legt die geprüften Zeilen des CSV-Imports an. Mit Karte werden alle der
    Reihe nach vorgemerkt (Automat, "Nutzer hinzufügen"), ohne Karte sofort
    angelegt. Antwortet mit einem Ergebnis pro Zeile, in derselben Reihenfolge."""
    if not checkAuth(flask.request.cookies.get("auth")):
        return flask.make_response("authorisation failed"), 401
    if not logedin[flask.request.cookies.get("auth")]["admin"]:
        return flask.make_response("authorisation failed"), 401

    body = flask.request.get_json(silent=True) or {}
    rows = body.get("rows")
    if not isinstance(rows, list):
        return flask.make_response("rows fehlt"), 400
    with_card = bool(body.get("withCard"))
    endpoint = "/student/addStudent" if with_card else "/student/addWithoutCard"

    results = []
    for row in rows:
        try:
            address = row.get("address") or {}
            data = {
                "firstName": str(row["firstName"]).strip(),
                "lastName": str(row["lastName"]).strip(),
                "gender": str(row["gender"]),
                "birthday": int(row.get("birthday") or 0),
                "address": {
                    "nr": int(address.get("nr") or 0),
                    "street": str(address.get("street") or ""),
                    "city": str(address.get("city") or ""),
                    "zip": int(address.get("zip") or 0),
                    "country": str(address.get("country") or "Deutschland"),
                },
                "kurse": [int(k) for k in row.get("kurse") or []],
            }
        except (KeyError, TypeError, ValueError):
            results.append({"status": "error", "message": "Zeile unvollständig"})
            continue
        if not data["firstName"] or not data["lastName"]:
            results.append({"status": "error", "message": "Name fehlt"})
            continue
        if data["gender"] not in GENDERS:
            results.append({"status": "error", "message": "Geschlecht unbekannt"})
            continue

        r = _call("post", IP + endpoint, json_body=data)
        if r is None:
            results.append({"status": "error", "message": "vom Backend abgelehnt"})
        else:
            results.append({"status": "queued" if with_card else "created"})
    return {"results": results}


@app.route("/add_teacher", methods=["POST"])
def add_teacher():
    global scanner;
    if not checkAuth(flask.request.cookies.get("auth")):
        return "fail"
    if not logedin[flask.request.cookies.get("auth")]["admin"]:
        return "fail"

    data = flask.request.get_json();
    rfid_field = data.pop("rfid", None)

    # Lehrkräfte laufen nicht über die Warteschlange, sie werden sofort
    # angelegt. Eine Karte wird - falls gewünscht - hinterher über
    # "Lehrkräfte -> bearbeiten -> Karte scannen" zugewiesen; hier blockierend
    # auf einen Scan zu warten würde nur den Automaten-Scan wegschnappen.
    scanned_rfid = rfid_field if isinstance(rfid_field, list) else []

    data["rfid"] = scanned_rfid;
    r = _call("post", IP + "/teacher/addTeacher", json_body=data);
    if r is None: return "fail"
    return "success";


@app.route("/change_teacher", methods=["POST"])
def change_teacher():
    if not checkAuth(flask.request.cookies.get("auth")):
        return "fail"
    if not logedin[flask.request.cookies.get("auth")]["admin"]:
        return "fail"

    changes = flask.request.get_json()
    teacher = {
        "id": int(changes["id"]),
        "firstName": changes.get("firstName", ""),
        "lastName": changes.get("lastName", ""),
        "rfid": changes.get("rfid", []),
        "gender": changes.get("gender", ""),
        "birthday": int(changes.get("birthday") or 0),
        "wohnort": changes.get("wohnort", {}),
        "mail": changes.get("mail", ""),
        "level": changes.get("level", "NORMAL"),
        "password": changes.get("passwordHash", ""),
    }
    if changes.get("newPassword"):
        hashed = bcrypt.hashpw(changes["newPassword"].encode(), bcrypt.gensalt()).decode()
        teacher["password"] = hashed

    r = _call("post", IP + "/teacher/modify", json_body=teacher)
    if r is not None:
        return "success"
    return "fail"


@app.route("/delete_teacher", methods=["POST"])
def delete_teacher():
    if not checkAuth(flask.request.cookies.get("auth")):
        return "fail"
    if not logedin[flask.request.cookies.get("auth")]["admin"]:
        return "fail"

    teacher_id = flask.request.get_json()["id"]
    r = _call("delete", IP + "/teacher/delete", json_body={"id": int(teacher_id)})
    if r is not None and r.status_code == 200:
        return "success"
    return "fail"


@app.route("/start_scan", methods=["POST"])
def start_scan():
    global scanner
    if not checkAuth(flask.request.cookies.get("auth")):
        return flask.make_response("authorisation failed"), 401
    # Bewusst komplett neu setzen: ein liegengebliebener Scan von vorher würde
    # sonst sofort als "gescannt" durchgehen.
    scanner = {"active": True, "id": []}
    return "started"


@app.route("/check_scan", methods=["POST"])
def check_scan():
    global scanner
    if not checkAuth(flask.request.cookies.get("auth")):
        return flask.make_response("authorisation failed"), 401
    if scanner["active"] and scanner["id"] != []:
        rfid = scanner["id"]
        scanner = {"active": False, "id": []}
        return {"status": "done", "rfid": rfid}
    return {"status": "waiting"}


@app.route("/change_user", methods=["POST"])
def change_user():
    if not checkAuth(flask.request.cookies.get("auth")):
        return "fail"

    changes = flask.request.get_json();
    student_id = int(changes["id"]);

    user = logedin[flask.request.cookies.get("auth")]
    is_admin = user["admin"]
    # Kursleitung darf Anwesenheit/Zeitkonto der eigenen Teilnehmenden pflegen.
    may_track = is_admin or is_tutor_of_student(user, student_id)
    if not may_track:
        return "fail"

    if is_admin:
        if changes.get("name"):
            parts = changes["name"].split(" ", 1)
            patch = {
                "id": student_id,
                "firstName": parts[0],
                "lastName": parts[1] if len(parts) > 1 else "",
            }
            _call("post", IP + "/student/modify", json_body=patch)

        if changes.get("courses") is not None:
            new_course_ids = {int(x) for x in changes["courses"] if x != ""}
            r = _call("get", IP + "/student/allStudents")
            if r is not None:
                all_s = json.loads(r.text)["students"]
                student_obj = next((s for s in all_s if s["id"] == student_id), None)
                if student_obj is not None:
                    current_course_ids = {k["id"] for k in student_obj.get("kurse", [])}
                    for cid in new_course_ids - current_course_ids:
                        _call("post", IP + "/course/modify", json_body={"id": cid, "addStudent": str(student_id)})
                    for cid in current_course_ids - new_course_ids:
                        _call("post", IP + "/course/modify", json_body={"id": cid, "removeStudent": str(student_id)})

        demo_patch = {"id": student_id}
        if changes.get("gender"):
            demo_patch["gender"] = changes["gender"]
        if changes.get("birthday") and int(changes["birthday"]) > 0:
            demo_patch["birthday"] = int(changes["birthday"])
        if changes.get("wohnort"):
            demo_patch["wohnort"] = changes["wohnort"]
        if isinstance(changes.get("rfid"), list) and len(changes["rfid"]) > 0:
            demo_patch["rfid"] = changes["rfid"]
        if len(demo_patch) > 1:
            _call("post", IP + "/student/modify", json_body=demo_patch)

    if changes.get("hours") is not None:
        _call("post", IP + "/student/modify", json_body={"id": student_id, "hours": float(changes["hours"])})

    # Nur wenn der Status wirklich geändert wurde - das Popup schickt das Feld
    # sonst gar nicht mit. /attendances/set ersetzt den Tag, statt wie früher
    # /seed/attendance einen weiteren Eintrag danebenzulegen.
    att_type = {"present": "NORMAL", "excused": "EXCUSED", "absent": "AWAY", "none": "NONE"}.get(changes.get("attendance"))
    if changes.get("date") and att_type:
        dt = datetime.utcfromtimestamp(int(changes["date"]));
        r = _call("post", IP + "/attendances/set", json_body={
            "id": student_id,
            "day": dt.day,
            "month": dt.month,
            "year": dt.year,
            "type": att_type,
        });
        if r is None:
            return "fail"

    return "success"


@app.route("/delete_user", methods=["POST"])
def delete_user():
    if checkAuth(flask.request.cookies.get("auth")):
        if logedin[flask.request.cookies.get("auth")]["admin"]:
            user_id = flask.request.get_json()["id"];
            r = _call("delete", IP + "/student/delete", json_body={"id": int(user_id)});
            if r is not None and r.status_code == 200:
                return "success";
    return "fail"


@app.route("/student_names", methods=["POST"])
def student_names():
    if not checkAuth(flask.request.cookies.get("auth")):
        return flask.make_response("authorisation failed"), 401
    if not logedin[flask.request.cookies.get("auth")]["admin"]:
        return flask.make_response("authorisation failed"), 401
    r = _call("get", IP + "/student/allStudents")
    if r is None: return flask.make_response("backend unavailable", 503)
    students = json.loads(r.text)["students"]
    return [{"id": s["id"], "firstName": s["firstName"], "lastName": s["lastName"]} for s in students]


@app.route("/student_attendances", methods=["POST"])
def student_attendances():
    if not checkAuth(flask.request.cookies.get("auth")):
        return flask.make_response("authorisation failed"), 401

    student_id = flask.request.get_json().get("id")
    return day_statuses(get_attendances(student_id))


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
    if not checkAuth(flask.request.cookies.get("auth")):
        return "fail"
    if not logedin[flask.request.cookies.get("auth")]["admin"]:
        return "fail"

    changes = flask.request.get_json()
    course_id = int(changes["old"])

    patch = {"id": course_id}
    if changes.get("name"):
        patch["name"] = changes["name"]
    if changes.get("day"):
        patch["day"] = changes["day"]
    if len(patch) > 1:
        _call("post", IP + "/course/modify", json_body=patch)

    new_tutor_ids = set()
    if changes.get("users"):
        new_tutor_ids = {str(x).strip() for x in str(changes["users"]).split(",") if x.strip()}

    r = _call("get", IP + "/course/allCourses")
    current_tutor_ids = set()
    if r is not None:
        for c in json.loads(r.text)["courses"]:
            if c["id"] == course_id:
                current_tutor_ids = {str(t["id"]) for t in c.get("tutor", [])}
                break

    for tid in new_tutor_ids - current_tutor_ids:
        _call("post", IP + "/course/modify", json_body={"id": course_id, "addTeacher": str(tid)})
    for tid in current_tutor_ids - new_tutor_ids:
        _call("post", IP + "/course/modify", json_body={"id": course_id, "removeTeacher": str(tid)})

    if "students" in changes:
        new_student_ids = {int(x) for x in (changes["students"] or []) if x != ""}
        r2 = _call("get", IP + "/student/allStudents")
        if r2 is not None:
            all_students = json.loads(r2.text)["students"]
            current_student_ids = {
                s["id"] for s in all_students
                if any(k["id"] == course_id for k in s.get("kurse", []))
            }
            for sid in new_student_ids - current_student_ids:
                _call("post", IP + "/course/modify", json_body={"id": course_id, "addStudent": str(sid)})
            for sid in current_student_ids - new_student_ids:
                _call("post", IP + "/course/modify", json_body={"id": course_id, "removeStudent": str(sid)})

    return "success"


@app.route("/delete_course", methods=["POST"])
def delete_course():
    if checkAuth(flask.request.cookies.get("auth")):
        if logedin[flask.request.cookies.get("auth")]["admin"]:
            course_id = flask.request.get_json()["id"];
            r = _call("delete", IP + "/course/delete", json_body={"id": int(course_id)});
            if r is not None and r.status_code == 200:
                return "success";
    return "fail";


GENDERS = [
    # Muss mit dem Gender-Enum des Backends übereinstimmen (Gender.java) - sonst
    # bietet die Auswahl Werte an, die beim Anlegen abgelehnt werden.
    "FEMALE", "MALE", "NON_BINARY", "AGENDER", "BIGENDER", "GENDERFLUID",
    "GENDERQUEER", "TRANSGENDER", "CISGENDER", "INTERSEX", "TWO_SPIRIT",
]

@app.route("/genders", methods=["POST"])
def genders():
    if not checkAuth(flask.request.cookies.get("auth")):
        return "n/a";
    # Maßgeblich ist das Gender-Enum des Backends. Die lokale GENDERS-Liste ist
    # nur noch Notfall-Fallback: sie war veraltet, wodurch die Auswahl Werte
    # anbot (z.B. "ABINARY"), die das Backend beim Anlegen ablehnt.
    r = _call("get", IP + "/genders")
    if r is None:
        return GENDERS;
    # Das Backend liefert die Werte zeilenweise als reinen Text.
    values = [line.strip() for line in r.text.splitlines() if line.strip()]
    return values or GENDERS;


def inRange(fromm, to, x):
    f = str(fromm) if fromm != '' else "0000-00-00"
    t = str(to) if to != '' else "9999-99-99"
    return f <= str(x) <= t


@app.route("/csv", methods=["POST"])
def csv():
    if not checkAuth(flask.request.cookies.get("auth")):
        return flask.make_response("authorisation failed"), 401
    if not logedin[flask.request.cookies.get("auth")]["admin"]:
        return flask.make_response("authorisation failed"), 401

    fromm = flask.request.form.get("from", "")
    to = flask.request.form.get("to", "")
    course_filter = flask.request.form.get("course", "all")

    file_path = "students.csv"
    if os.path.exists(file_path):
        os.remove(file_path)

    r = _call("get", IP + "/student/allStudents");
    if r is None: return flask.make_response("backend unavailable", 503)
    students = json.loads(r.text)["students"];
    students.sort(key=lambda s: s["id"])

    if course_filter not in ("all", "", "-1", "All"):
        try:
            cid = int(course_filter)
            students = [s for s in students
                        if any(k["id"] == cid for k in s.get("kurse", []))]
        except ValueError:
            pass

    all_days = set()
    rows = []

    for student in students:
        statuses = {d: s for d, s in day_statuses(get_attendances(student["id"])).items()
                    if inRange(fromm, to, d)}
        all_days.update(statuses)
        rows.append({
            "id": student["id"],
            "name": student["firstName"] + " " + student["lastName"],
            "days": statuses,
        })

    sorted_days = sorted(all_days)
    # Entschuldigt ist nicht dasselbe wie anwesend - früher stand dort "Ja".
    labels = {"normal": "Ja", "excused": "Entschuldigt", "absent": "Nein"}

    with open('./students.csv', 'w', newline='') as csvfile:
        writer = csvBib.writer(csvfile, delimiter=';')
        writer.writerow(['Index', 'Name'] + sorted_days)
        for row in rows:
            line = [str(row["id"]), row["name"]] + \
                   [labels[row["days"].get(d, "absent")] for d in sorted_days]
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
    app.run(port=8080, host="0.0.0.0", debug=True, threaded=True)
