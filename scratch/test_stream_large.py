import asyncio, httpx, json, sys

payload = {
    "conversation_id": "test_stream",
    "messages": [{"role": "user", "content": "What is 2 plus 2?"}],
    "model": "richardyoung/qwythos-9b-abliterated:Q4_K_M",
    "temperature": 0.7,
    "stream": True,
}

async def main():
    async with httpx.AsyncClient(timeout=300, trust_env=False) as client:
        async with client.stream('POST', 'http://127.0.0.1:8000/v1/chat/completions', json=payload) as response:
            if response.status_code != 200:
                print('Error status', response.status_code)
                print('Body', await response.aread())
                sys.exit(1)
            async for line in response.aiter_lines():
                if line.strip():
                    try:
                        data = json.loads(line)
                        print('Chunk:', data)
                    except Exception as e:
                        print('Parse error', e, line)

if __name__ == '__main__':
    asyncio.run(main())
