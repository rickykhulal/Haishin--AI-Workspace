import json, requests, sys, time

def test_model(model_id, prompt, timeout=180):
    url = "http://127.0.0.1:8000/v1/chat/completions"
    payload = {
        "model": model_id,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "max_tokens": 100,
    }
    try:
        resp = requests.post(url, json=payload, timeout=timeout)
        resp.raise_for_status()
        data = resp.json()
        # Print concise output
        print(f"=== Model: {model_id} ===")
        # Extract content
        if "choices" in data and data["choices"]:
            choice = data["choices"][0]
            msg = choice.get("message", {})
            if "content" in msg:
                print(msg["content"].strip())
            else:
                print("<no content>")
        else:
            print("<no choices>")
    except Exception as e:
        print(f"=== Model: {model_id} ERROR ===")
        print(e)
        sys.exit(1)

if __name__ == "__main__":
    # Test small model
    test_model("llama3.2:1b", "Reply with exactly: HAISHIN_SMALL_MODEL_OK")
    # Small pause
    time.sleep(2)
    # Test large model
    test_model("richardyoung/qwythos-9b-abliterated:Q4_K_M", "Reply with exactly: HAISHIN_LARGE_MODEL_OK", timeout=300)
