"""
Evaluation engine for Haishin v0.4 benchmarks.
Implements deterministic validators and clearly labeled approximate heuristics.
Never claims subjective answer quality is absolute.
"""

import json
import re
from typing import Tuple, Dict, Any, Callable


def _clean_text(text: str) -> str:
    """Normalize text by stripping quotes, backticks, and extra whitespace."""
    t = text.strip()
    if t.startswith("```json"):
        t = t[7:]
    elif t.startswith("```python"):
        t = t[9:]
    elif t.startswith("```"):
        t = t[3:]
    if t.endswith("```"):
        t = t[:-3]
    return t.strip()


# ── Individual Validators ───────────────────────────────────────────────────

def eval_fact_capital_nepal(output: str) -> Tuple[bool, float, str]:
    cleaned = output.lower()
    if "kathmandu" in cleaned:
        return True, 1.0, "Correctly identified Kathmandu as the capital of Nepal."
    return False, 0.0, f"Expected 'Kathmandu', got: '{output[:80]}'"


def eval_fact_water_boiling_point(output: str) -> Tuple[bool, float, str]:
    numbers = re.findall(r"\b100\b", output)
    if numbers:
        return True, 1.0, "Correctly identified 100 degrees Celsius."
    return False, 0.0, f"Expected '100', got: '{output[:80]}'"


def eval_fact_mars_red_planet(output: str) -> Tuple[bool, float, str]:
    if "mars" in output.lower():
        return True, 1.0, "Correctly identified Mars."
    return False, 0.0, f"Expected 'Mars', got: '{output[:80]}'"


def eval_reason_mult_17x4(output: str) -> Tuple[bool, float, str]:
    # 17 * 4 = 68
    numbers = re.findall(r"\b68\b", output)
    if numbers:
        return True, 1.0, "Correctly calculated 17 * 4 = 68."
    return False, 0.0, f"Expected '68', got: '{output[:80]}'"


def eval_reason_apple_box(output: str) -> Tuple[bool, float, str]:
    # 20 - 5 + 8 = 23
    numbers = re.findall(r"\b23\b", output)
    if numbers:
        return True, 1.0, "Correctly calculated 20 - 5 + 8 = 23."
    return False, 0.0, f"Expected '23', got: '{output[:80]}'"


def eval_reason_speed_distance(output: str) -> Tuple[bool, float, str]:
    # 80 * 2.5 = 200
    numbers = re.findall(r"\b200\b", output)
    if numbers:
        return True, 1.0, "Correctly calculated 80 * 2.5 = 200 km."
    return False, 0.0, f"Expected '200', got: '{output[:80]}'"


def eval_inst_exact_word_count(output: str) -> Tuple[bool, float, str]:
    # Strip common punctuation
    cleaned = re.sub(r"[^\w\s]", "", output).strip()
    words = cleaned.split()
    if len(words) == 3:
        return True, 1.0, f"Followed exact 3-word instruction: {words}"
    return False, 0.0, f"Expected exactly 3 words, found {len(words)} words: {words}"


def eval_inst_negative_constraint(output: str) -> Tuple[bool, float, str]:
    # 3 fruits without 'a' or 'e'
    raw_items = [i.strip().lower() for i in re.split(r"[,;\n]", output) if i.strip()]
    if not raw_items:
        return False, 0.0, "Empty or unparseable list of fruits."

    forbidden = [item for item in raw_items if "a" in item or "e" in item]
    if forbidden:
        return False, 0.0, f"Contained forbidden letter 'a' or 'e': {forbidden}"

    if len(raw_items) >= 3:
        return True, 1.0, f"Provided {len(raw_items)} fruits without 'a' or 'e': {raw_items[:3]}"
    return False, 0.5, f"Only provided {len(raw_items)} items without 'a' or 'e', expected 3."


def eval_inst_all_caps_confirmed(output: str) -> Tuple[bool, float, str]:
    cleaned = output.strip().strip("'\".").strip()
    if cleaned == "CONFIRMED":
        return True, 1.0, "Exact match for 'CONFIRMED'."
    if "CONFIRMED" in output:
        return True, 0.8, "Contained 'CONFIRMED' with minor extra characters."
    return False, 0.0, f"Expected 'CONFIRMED', got: '{output[:60]}'"


def eval_code_reverse_string(output: str) -> Tuple[bool, float, str]:
    has_def = "def reverse_string" in output
    has_rev = "[::-1]" in output or "reversed(" in output
    if has_def and has_rev:
        return True, 1.0, "Valid reverse_string function signature and slice/reversed logic."
    if has_def:
        return False, 0.5, "Function signature present but missing standard reverse logic."
    return False, 0.0, "Missing function definition `def reverse_string`."


def eval_code_debug_even_parity(output: str) -> Tuple[bool, float, str]:
    # Approximate heuristic check
    lower = output.lower()
    mentions_odd = "odd" in lower
    mentions_zero = "== 0" in lower or "= 0" in lower or "zero" in lower or "remainder 0" in lower
    mentions_bug = "% 2 == 1" in output or "returns true for odd" in lower or "not even" in lower

    if (mentions_odd and (mentions_zero or mentions_bug)) or (mentions_zero and mentions_bug):
        return True, 1.0, "[Approximate] Correctly explained that n % 2 == 1 checks for odd numbers."
    if mentions_odd or mentions_zero:
        return True, 0.7, "[Approximate] Partially identified parity condition issue."
    return False, 0.0, f"[Approximate] Did not clearly identify the parity bug. Output: {output[:80]}"


def eval_code_is_palindrome(output: str) -> Tuple[bool, float, str]:
    has_def = "def is_palindrome" in output
    has_check = "[::-1]" in output or "reversed" in output or "==" in output
    if has_def and has_check:
        return True, 1.0, "Valid is_palindrome function structure."
    return False, 0.0, "Missing valid `def is_palindrome` function."


def eval_sum_local_ai_passage(output: str) -> Tuple[bool, float, str]:
    # Approximate heuristic: single sentence, mentions running locally/ollama
    cleaned = output.strip()
    # Count sentence terminators
    sentences = [s.strip() for s in re.split(r"[.!?]\s+", cleaned) if s.strip()]
    lower = cleaned.lower()
    has_local = "local" in lower or "ollama" in lower or "hardware" in lower
    if len(sentences) == 1 and has_local:
        return True, 1.0, "[Approximate] Single sentence accurately summarizing local LLM execution."
    if has_local:
        return True, 0.7, f"[Approximate] Captured topic but produced {len(sentences)} sentences instead of 1."
    return False, 0.0, "[Approximate] Summary failed to capture key topic of local model execution."


def eval_sum_states_of_matter(output: str) -> Tuple[bool, float, str]:
    lower = output.lower()
    has_solid = "solid" in lower
    has_liquid = "liquid" in lower
    has_gas = "gas" in lower

    # Check for bullets (- or * or numbers)
    bullet_lines = [l for l in output.splitlines() if re.match(r"^\s*[-*•\d+.]", l)]
    if has_solid and has_liquid and has_gas and len(bullet_lines) >= 3:
        return True, 1.0, "Produced 3 bullets covering solid, liquid, and gas."
    if has_solid and has_liquid and has_gas:
        return True, 0.7, "Covered all three states of matter but formatting differed from 3 bullets."
    return False, 0.0, "Did not enumerate solid, liquid, and gas."


def eval_sum_news_headline(output: str) -> Tuple[bool, float, str]:
    cleaned = _clean_text(output)
    # Remove quotes
    cleaned = cleaned.strip("\"'#").strip()
    words = cleaned.split()
    lower = cleaned.lower()
    mentions_core = ("water" in lower or "ice" in lower) and "moon" in lower

    if len(words) <= 8 and mentions_core:
        return True, 1.0, f"[Approximate] Valid headline with {len(words)} words: '{cleaned}'"
    if mentions_core:
        return False, 0.5, f"[Approximate] Covered news topic but exceeded 8 words ({len(words)} words)."
    return False, 0.0, f"[Approximate] Headline missed core subject: '{cleaned[:60]}'"


def eval_struct_json_book(output: str) -> Tuple[bool, float, str]:
    cleaned = _clean_text(output)
    # Try parsing JSON
    try:
        data = json.loads(cleaned)
        if isinstance(data, dict):
            keys = {k.lower() for k in data.keys()}
            if "title" in keys and "author" in keys and "year" in keys:
                return True, 1.0, f"Valid JSON with required keys: {list(data.keys())}"
            return False, 0.5, f"Valid JSON but missing one or more keys (title, author, year): {list(data.keys())}"
        return False, 0.0, "JSON parsed but root is not a dictionary object."
    except json.JSONDecodeError as exc:
        return False, 0.0, f"Invalid JSON syntax: {exc.msg} in '{cleaned[:60]}'"


def eval_struct_csv_weather(output: str) -> Tuple[bool, float, str]:
    cleaned = _clean_text(output)
    lines = [l.strip() for l in cleaned.splitlines() if l.strip()]
    if len(lines) < 2:
        return False, 0.0, f"Expected header + data row (>=2 lines), got {len(lines)} lines."

    header = lines[0].lower()
    data_row = lines[1]
    if "city" in header and "temperature" in header and "condition" in header:
        if "," in data_row and ("pokhara" in data_row.lower() or "24" in data_row):
            return True, 1.0, f"Valid CSV format with header '{header}' and data row."
        return False, 0.5, "Valid CSV header, but data row missing expected values."
    return False, 0.0, f"CSV header did not contain required columns. Got: '{header}'"


def eval_struct_kv_mountain(output: str) -> Tuple[bool, float, str]:
    cleaned = output.strip()
    has_name = bool(re.search(r"NAME:\s*Annapurna", cleaned, re.IGNORECASE))
    has_elev = bool(re.search(r"ELEVATION:\s*8091", cleaned, re.IGNORECASE))
    has_country = bool(re.search(r"COUNTRY:\s*Nepal", cleaned, re.IGNORECASE))

    if has_name and has_elev and has_country:
        return True, 1.0, "Correctly matched all KEY: VALUE pairs for Annapurna, 8091, Nepal."
    matched_count = sum([has_name, has_elev, has_country])
    if matched_count >= 1:
        return False, round(matched_count / 3.0, 2), f"Partially matched {matched_count}/3 KEY: VALUE pairs."
    return False, 0.0, f"Failed KEY: VALUE formatting. Output: '{output[:80]}'"


# ── Dispatcher ──────────────────────────────────────────────────────────────

EVALUATORS: Dict[str, Callable[[str], Tuple[bool, float, str]]] = {
    "fact-capital-nepal": eval_fact_capital_nepal,
    "fact-water-boiling-point": eval_fact_water_boiling_point,
    "fact-mars-red-planet": eval_fact_mars_red_planet,
    "reason-mult-17x4": eval_reason_mult_17x4,
    "reason-apple-box": eval_reason_apple_box,
    "reason-speed-distance": eval_reason_speed_distance,
    "inst-exact-word-count": eval_inst_exact_word_count,
    "inst-negative-constraint": eval_inst_negative_constraint,
    "inst-all-caps-confirmed": eval_inst_all_caps_confirmed,
    "code-reverse-string": eval_code_reverse_string,
    "code-debug-even-parity": eval_code_debug_even_parity,
    "code-is-palindrome": eval_code_is_palindrome,
    "sum-local-ai-passage": eval_sum_local_ai_passage,
    "sum-states-of-matter": eval_sum_states_of_matter,
    "sum-news-headline": eval_sum_news_headline,
    "struct-json-book": eval_struct_json_book,
    "struct-csv-weather": eval_struct_csv_weather,
    "struct-kv-mountain": eval_struct_kv_mountain,
}


def evaluate_output(prompt_id: str, output: str) -> Tuple[bool, float, str]:
    """
    Evaluate output for a given prompt ID.
    Returns (passed, score, reason).
    """
    evaluator = EVALUATORS.get(prompt_id)
    if not evaluator:
        return False, 0.0, f"No evaluator registered for prompt ID '{prompt_id}'."
    return evaluator(output)
