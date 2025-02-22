import requests;

# beispiel für die request, die an den Server gehen soll
def dispense(n: int):
    r = requests.post("http://127.0.0.1:8000/dispense", json={"nr": n});
    print(r.text)

def scanned(id: list[int]):
    r = requests.post("http://127.0.0.1:8000/scanned", json=id)
    print(r.text)

#time in seconds
scanned({"name": "Ben Schnorri","time": 3600,"rfid": [99, 179, 107, 0, 187]});
