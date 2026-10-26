"""
Fixed, version-controlled benchmark evaluation prompts for Haishin v0.4.
Covers 6 distinct evaluation categories with deterministic and clearly labeled approximate evaluators.
Benchmark Version: 1.0
"""

from typing import List, Dict, Any, Literal

BENCHMARK_VERSION = "1.0"

BenchmarkCategory = Literal[
    "factual",
    "reasoning",
    "instruction_following",
    "coding",
    "summarization",
    "structured_output",
]

BENCHMARK_PROMPTS: List[Dict[str, Any]] = [
    # ── Category 1: Basic factual knowledge ──────────────────────────────────
    {
        "id": "fact-capital-nepal",
        "category": "factual",
        "prompt": "What is the capital city of Nepal? Answer in one short sentence or word.",
        "timeout": 20,
        "evaluation_type": "deterministic",
        "expected": "Kathmandu",
        "smoke": True,
    },
    {
        "id": "fact-water-boiling-point",
        "category": "factual",
        "prompt": "At standard sea-level atmospheric pressure, what is the boiling point of pure water in degrees Celsius? State only the number.",
        "timeout": 20,
        "evaluation_type": "deterministic",
        "expected": "100",
        "smoke": False,
    },
    {
        "id": "fact-mars-red-planet",
        "category": "factual",
        "prompt": "Which planet in our solar system is nicknamed the 'Red Planet'?",
        "timeout": 20,
        "evaluation_type": "deterministic",
        "expected": "Mars",
        "smoke": False,
    },

    # ── Category 2: Simple reasoning and arithmetic ──────────────────────────
    {
        "id": "reason-mult-17x4",
        "category": "reasoning",
        "prompt": "What is 17 multiplied by 4? Output only the numerical answer without extra commentary.",
        "timeout": 20,
        "evaluation_type": "deterministic",
        "expected": "68",
        "smoke": True,
    },
    {
        "id": "reason-apple-box",
        "category": "reasoning",
        "prompt": "A basket contains 20 apples. Alice takes 5 apples, and Bob adds 8 apples. How many apples are now in the basket? Provide the final number.",
        "timeout": 25,
        "evaluation_type": "deterministic",
        "expected": "23",
        "smoke": False,
    },
    {
        "id": "reason-speed-distance",
        "category": "reasoning",
        "prompt": "If a car travels at a constant speed of 80 kilometers per hour, how many kilometers does it travel in 2.5 hours? State the number.",
        "timeout": 25,
        "evaluation_type": "deterministic",
        "expected": "200",
        "smoke": False,
    },

    # ── Category 3: Instruction following ────────────────────────────────────
    {
        "id": "inst-exact-word-count",
        "category": "instruction_following",
        "prompt": "Write exactly three words describing the sky. Do not use punctuation or quotes.",
        "timeout": 20,
        "evaluation_type": "deterministic",
        "expected": "Exactly 3 whitespace-separated words",
        "smoke": False,
    },
    {
        "id": "inst-negative-constraint",
        "category": "instruction_following",
        "prompt": "Name three fruits without using the letter 'a' or 'e'. Separate them with commas.",
        "timeout": 25,
        "evaluation_type": "deterministic",
        "expected": "Three fruits with no 'a' or 'e' (e.g. kiwi, fig, plum)",
        "smoke": False,
    },
    {
        "id": "inst-all-caps-confirmed",
        "category": "instruction_following",
        "prompt": "Respond with the single word 'CONFIRMED' in all uppercase letters. Do not add any greeting or punctuation.",
        "timeout": 20,
        "evaluation_type": "deterministic",
        "expected": "CONFIRMED",
        "smoke": True,
    },

    # ── Category 4: Coding and debugging ─────────────────────────────────────
    {
        "id": "code-reverse-string",
        "category": "coding",
        "prompt": "Write a Python function named `reverse_string(s)` that returns the string reversed. Output only the code.",
        "timeout": 30,
        "evaluation_type": "deterministic",
        "expected": "Valid Python function reverse_string with [::-1] or reversed",
        "smoke": False,
    },
    {
        "id": "code-debug-even-parity",
        "category": "coding",
        "prompt": "What is the bug in this Python function:\n```python\ndef is_even(n):\n    return n % 2 == 1\n```\nExplain in one concise sentence what is wrong.",
        "timeout": 30,
        "evaluation_type": "approximate",
        "expected": "Identifies that % 2 == 1 checks for odd, not even",
        "smoke": False,
    },
    {
        "id": "code-is-palindrome",
        "category": "coding",
        "prompt": "Write a Python function named `is_palindrome(s)` that returns True if string s is a palindrome and False otherwise. Output the code block.",
        "timeout": 30,
        "evaluation_type": "deterministic",
        "expected": "Valid Python function is_palindrome",
        "smoke": False,
    },

    # ── Category 5: Summarization ────────────────────────────────────────────
    {
        "id": "sum-local-ai-passage",
        "category": "summarization",
        "prompt": "Summarize this passage in exactly one sentence: 'Ollama is an open-source tool that lets developers run open-weight language models locally on laptops and desktops without sending data to third-party cloud APIs. It manages model weights, memory offloading, and HTTP endpoints.'",
        "timeout": 30,
        "evaluation_type": "approximate",
        "expected": "Single-sentence summary mentioning local LLM execution",
        "smoke": False,
    },
    {
        "id": "sum-states-of-matter",
        "category": "summarization",
        "prompt": "Summarize the three common states of matter (solid, liquid, gas) into a 3-item bulleted list, exactly one bullet per state.",
        "timeout": 25,
        "evaluation_type": "deterministic",
        "expected": "3 bullet items referencing solid, liquid, gas",
        "smoke": False,
    },
    {
        "id": "sum-news-headline",
        "category": "summarization",
        "prompt": "Write a short headline under 8 words announcing that water ice was confirmed at the Moon's south pole.",
        "timeout": 20,
        "evaluation_type": "approximate",
        "expected": "Headline under 8 words mentioning water/ice on Moon",
        "smoke": False,
    },

    # ── Category 6: Structured output ────────────────────────────────────────
    {
        "id": "struct-json-book",
        "category": "structured_output",
        "prompt": "Output a valid JSON object with keys 'title', 'author', and 'year' for '1984' by George Orwell. Output only raw JSON without backticks or markdown.",
        "timeout": 25,
        "evaluation_type": "deterministic",
        "expected": "Valid JSON object with keys title, author, year",
        "smoke": False,
    },
    {
        "id": "struct-csv-weather",
        "category": "structured_output",
        "prompt": "Output a 2-row CSV string (header plus 1 data row) with columns 'city,temperature_c,condition' for Pokhara at 24 degrees and sunny.",
        "timeout": 25,
        "evaluation_type": "deterministic",
        "expected": "CSV with city,temperature_c,condition header and row",
        "smoke": False,
    },
    {
        "id": "struct-kv-mountain",
        "category": "structured_output",
        "prompt": "Output the following key-value data with each item on a new line formatted as 'KEY: VALUE':\nNAME: Annapurna\nELEVATION: 8091\nCOUNTRY: Nepal",
        "timeout": 25,
        "evaluation_type": "deterministic",
        "expected": "Key-value format containing NAME, ELEVATION, COUNTRY",
        "smoke": False,
    },
]

def get_prompts(smoke_only: bool = False) -> List[Dict[str, Any]]:
    """Return benchmark prompts (filtered for smoke test if requested)."""
    if smoke_only:
        return [p for p in BENCHMARK_PROMPTS if p.get("smoke")]
    return BENCHMARK_PROMPTS
