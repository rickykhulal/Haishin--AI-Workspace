import httpx, json, sys
url = 'http://127.0.0.1:8000/v1/chat/completions'
payload = {
    "model": "llama3.2:1b",
    "messages": [{"role": "user", "content": "What is 2+2?"}],
    "stream": False,
}
try:
    resp = httpx.post(url, json=payload, timeout=120.0)
    resp.raise_for_status()
    print(json.dumps(resp.json(), indent=2))
except Exception as e:
    print('Error:', e)
    sys.exit(1)
