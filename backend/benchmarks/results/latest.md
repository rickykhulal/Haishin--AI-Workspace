# Haishin Benchmark Report — bench_20261016_091008

- **Benchmark Version:** 1.0
- **Date & Time:** 2026-10-16T03:25:08.097122+00:00
- **Model:** `llama3.2:1b`
- **Test Mode:** Full Suite (18 prompts)
- **Total Duration:** 11.0s
- **Pass Rate:** **83.3%** (15/18 passed)
- **Average Latency:** 607 ms
- **Average Throughput:** 71.9 tok/s

## Status Breakdown

| Metric | Count |
| :--- | :--- |
| **Total Prompts** | 18 |
| **Passed** | 15 |
| **Failed** | 3 |
| **Timed Out** | 0 |
| **Errored** | 0 |

## Detailed Results

| ID | Category | Type | Status | Latency | Tok/s | Reason |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `fact-capital-nepal` | factual | deterministic | **PASS** | 326ms | 18.4 | Correctly identified Kathmandu as the capital of Nepal. |
| `fact-water-boiling-point` | factual | deterministic | **PASS** | 90ms | 55.6 | Correctly identified 100 degrees Celsius. |
| `fact-mars-red-planet` | factual | deterministic | **PASS** | 129ms | 77.5 | Correctly identified Mars. |
| `reason-mult-17x4` | reasoning | deterministic | **PASS** | 42ms | 47.6 | Correctly calculated 17 * 4 = 68. |
| `reason-apple-box` | reasoning | deterministic | **PASS** | 1248ms | 88.1 | Correctly calculated 20 - 5 + 8 = 23. |
| `reason-speed-distance` | reasoning | deterministic | **PASS** | 725ms | 92.4 | Correctly calculated 80 * 2.5 = 200 km. |
| `inst-exact-word-count` | instruction_following | deterministic | **PASS** | 116ms | 43.1 | Followed exact 3-word instruction: ['Clear', 'blue', 'vastness'] |
| `inst-negative-constraint` | instruction_following | deterministic | **FAIL** | 96ms | 72.9 | Contained forbidden letter 'a' or 'e': ['blueberry'] |
| `inst-all-caps-confirmed` | instruction_following | deterministic | **PASS** | 63ms | 63.5 | Exact match for 'CONFIRMED'. |
| `code-reverse-string` | coding | deterministic | **PASS** | 313ms | 70.3 | Valid reverse_string function signature and slice/reversed logic. |
| `code-debug-even-parity` | coding | approximate | **PASS** | 261ms | 84.3 | [Approximate] Correctly explained that n % 2 == 1 checks for odd numbers. |
| `code-is-palindrome` | coding | deterministic | **PASS** | 1743ms | 90.7 | Valid is_palindrome function structure. |
| `sum-local-ai-passage` | summarization | approximate | **PASS** | 342ms | 87.7 | [Approximate] Single sentence accurately summarizing local LLM execution. |
| `sum-states-of-matter` | summarization | deterministic | **PASS** | 1860ms | 91.4 | Produced 3 bullets covering solid, liquid, and gas. |
| `sum-news-headline` | summarization | approximate | **PASS** | 193ms | 57.0 | [Approximate] Valid headline with 7 words: 'Water Ice Found at Moon's South Pole' |
| `struct-json-book` | structured_output | deterministic | **FAIL** | 306ms | 81.7 | Invalid JSON syntax: Expecting ',' delimiter in '{
  "title": "1984",
  "author": "George Orwell",
  "year": ' |
| `struct-csv-weather` | structured_output | deterministic | **FAIL** | 2837ms | 89.2 | CSV header did not contain required columns. Got: 'here is a python script that generates a 2-row csv string with the specified columns and data:' |
| `struct-kv-mountain` | structured_output | deterministic | **PASS** | 241ms | 83.0 | Correctly matched all KEY: VALUE pairs for Annapurna, 8091, Nepal. |

---
*Note: Results from a single run are preliminary. Approximate evaluation checks are labeled accordingly.*
