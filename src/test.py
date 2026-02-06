import flask
import requests
import time

import threading

app = flask.Flask(__name__);
ip = "http://127.0.0.1:8000/scanned"

@app.route("/ping")
def index():
    print(flask.request.remote_addr)
    return "Ben ist toll."

thread = threading.Thread(target=app.run, args=());

thread.start()

while True:
    i = input()
    if i == "scan":
        print(ip)
        r = requests.post(ip, json={"rfid": [99, 253, 101, 0, 251]})
        print(r.text)
        

