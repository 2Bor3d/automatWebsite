import requests;

# beispiel für die request, die an den Server gehen soll
def dispense(n: int):
    r = requests.post("http://127.0.0.1:5000/dispense", json={"nr": n});
    print(r.text)

def scanned(id: list[int]):
    r = requests.post("http://127.0.0.1:5000", json=id)
    print(r.text)

scanned([99, 179, 107, 0, 187]);

