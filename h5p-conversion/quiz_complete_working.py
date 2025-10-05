#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
COMPLETE WORKING Moodle Quiz Submission
- Handles multiple pages (one question per page)
- Parses aria-labelledby for correct answer matching
- Auto-clears in-progress attempts
"""

import re
import requests
from bs4 import BeautifulSoup

MOODLE_URL = "https://karthitest.moodlecloud.com"
TOKEN      = "c0ee6baca141679fdd6793ad397e6f21"
QUIZ_ID    = 4
QUIZ_PASSWORD = None

# WhatsApp answers (from actual conversation)
# A, C, A, C, B = 80% expected
WHATSAPP_ANSWERS = [
    {"stem": "guiding students to discover knowledge", "answer_text": "Facilitator of Learning"},
    {"stem": "primary purpose of continuous assessment", "answer_text": "To evaluate and adjust teaching"},
    {"stem": "guiding students to discover knowledge", "answer_text": "Facilitator of Learning"},
    {"stem": "teacher's behavior, attitudes, and values", "answer_text": "Mentor and Role Model"},
    {"stem": "Assessment should only be used to give final", "answer_text": "False"},
]

EP = f"{MOODLE_URL}/webservice/rest/server.php"

def ws(fn, **params):
    data = {"wstoken": TOKEN, "wsfunction": fn, "moodlewsrestformat": "json", **params}
    r = requests.post(EP, data=data, timeout=30)
    r.raise_for_status()
    try:
        j = r.json()
    except Exception:
        raise RuntimeError(f"Non-JSON response for {fn}: {r.text[:400]}")
    if isinstance(j, dict) and "exception" in j:
        raise RuntimeError(f"{fn} -> {j.get('errorcode')}: {j.get('message')}")
    return j

def norm(s):
    return re.sub(r"\s+", " ", (s or "")).strip().lower()

def discover_question_fields(question_html):
    soup = BeautifulSoup(question_html or "", "html.parser")

    # Find sequencecheck
    seq_name, seq_val = None, None
    for hid in soup.select('input[type="hidden"]'):
        nm = hid.get("name", "")
        if nm.endswith("_:sequencecheck"):
            seq_name = nm
            seq_val = hid.get("value", "1")
            break

    # Gather radio options - supports aria-labelledby
    choices = []
    radios = soup.select('input[type="radio"]')
    for r in radios:
        nm = r.get("name", "")
        val = r.get("value", "")
        label_txt = ""

        # Try aria-labelledby (Moodle's structure)
        labelledby = r.get("aria-labelledby")
        if labelledby:
            label_div = soup.find(id=labelledby)
            if label_div:
                label_txt = label_div.get_text(" ", strip=True)

        # Fallback methods
        if not label_txt and r.has_attr("id"):
            lab = soup.find("label", attrs={"for": r["id"]})
            if lab:
                label_txt = lab.get_text(" ", strip=True)

        if not label_txt:
            parent = r.find_parent("label")
            if parent:
                label_txt = parent.get_text(" ", strip=True)

        if not label_txt:
            label_txt = r.get("value", "")

        choices.append({"name": nm, "value": val, "label": label_txt})

    return seq_name, seq_val, choices

def choose_option(choices, desired_text):
    """Match by answer text"""
    if desired_text:
        t = norm(desired_text)
        for ch in choices:
            if t and t in norm(ch["label"]):
                return str(ch["name"]), str(ch["value"])

    # Fallback: first option
    if choices:
        return str(choices[0]["name"]), str(choices[0]["value"])

    return "", ""

def match_answer(page_text, whatsapp_answers):
    """Find matching WhatsApp answer for this question"""
    for ans in whatsapp_answers:
        stem = norm(ans.get("stem", ""))
        if stem and stem in page_text:
            return ans
    return whatsapp_answers[0] if whatsapp_answers else {}

def clear_in_progress_attempts(quizid):
    """Clear blocking attempts"""
    try:
        attempts = ws("mod_quiz_get_user_attempts", quizid=quizid)
    except:
        attempts = ws("mod_quiz_get_user_quiz_attempts", quizid=quizid)

    if isinstance(attempts, dict):
        attempts = attempts.get("attempts", [])

    in_progress = [a for a in attempts if a.get("state") in ("inprogress", "inprogresspending", "overdue")]

    if in_progress:
        print(f"🧹 Clearing {len(in_progress)} in-progress attempt(s)...")
        for att in in_progress:
            try:
                ws("mod_quiz_process_attempt", attemptid=att["id"], finishattempt=1)
                print(f"   ✅ Cleared attempt {att['id']}")
            except Exception as e:
                print(f"   ⚠️  {e}")
        print()

def main():
    print("\n" + "="*70)
    print("  COMPLETE MOODLE QUIZ SUBMISSION")
    print("  (Multi-page support + aria-labelledby)")
    print("="*70 + "\n")

    # View quiz
    ws("mod_quiz_view_quiz", quizid=QUIZ_ID)

    # Clear blocking attempts
    clear_in_progress_attempts(QUIZ_ID)

    # Start attempt
    start_kwargs = {"quizid": QUIZ_ID}
    if QUIZ_PASSWORD:
        start_kwargs["preflightdata[0][name]"] = "quizpassword"
        start_kwargs["preflightdata[0][value]"] = QUIZ_PASSWORD

    started = ws("mod_quiz_start_attempt", **start_kwargs)
    attempt_id = started["attempt"]["id"]
    print(f"✅ Started attempt: {attempt_id}\n")

    # Collect all answers across all pages
    all_pairs = []
    remaining_answers = list(WHATSAPP_ANSWERS)  # Copy

    page_num = 0
    while True:
        print(f"📄 Page {page_num}...")

        # Get page data
        try:
            page_data = ws("mod_quiz_get_attempt_data", attemptid=attempt_id, page=page_num)
        except Exception as e:
            print(f"   No more pages ({e})")
            break

        questions = page_data.get("questions", [])
        if not questions:
            break

        # Process each question on this page
        for q in questions:
            html = q.get("html", "")
            if not html:
                continue

            slot = q.get("slot")
            print(f"   Q{slot}...", end=" ")

            # Get fields
            seq_name, seq_val, choices = discover_question_fields(html)

            # Match WhatsApp answer
            page_text = norm(BeautifulSoup(html, "html.parser").get_text(" ", strip=True))
            matched = match_answer(page_text, remaining_answers)

            # Remove used answer
            if matched in remaining_answers:
                remaining_answers.remove(matched)

            # Build pairs
            if seq_name and seq_val is not None:
                all_pairs.append((str(seq_name), str(seq_val)))

            ans_name, ans_value = choose_option(choices, matched.get("answer_text"))
            if ans_name and ans_value:
                all_pairs.append((str(ans_name), str(ans_value)))
                print(f"✅ {matched.get('answer_text', '?')[:30]}... → value={ans_value}")

        # Move to next page
        page_num += 1

    print(f"\n📝 Total answers collected: {len([p for p in all_pairs if not p[0].endswith('sequencecheck')])} questions\n")

    # Save all answers
    save_params = {"attemptid": attempt_id}
    for i, (n, v) in enumerate(all_pairs):
        save_params[f"data[{i}][name]"] = str(n)
        save_params[f"data[{i}][value]"] = str(v)

    try:
        ws("mod_quiz_save_attempt", **save_params)
        print("[SAVE] ✅")
    except RuntimeError as e:
        print(f"[SAVE] ⚠️  {e}")

    # Finish attempt
    finish_params = {"attemptid": attempt_id, "finishattempt": 1}
    for i, (n, v) in enumerate(all_pairs):
        finish_params[f"data[{i}][name]"] = str(n)
        finish_params[f"data[{i}][value]"] = str(v)

    try:
        done = ws("mod_quiz_process_attempt", **finish_params)
        print(f"[FINISH] ✅ State: {done.get('state')}\n")
    except RuntimeError as e:
        if "unsaved work" in str(e).lower():
            finish_params["preflightdata[0][name]"]  = "confirmdatasaved"
            finish_params["preflightdata[0][value]"] = "1"
            done = ws("mod_quiz_process_attempt", **finish_params)
            print(f"[FINISH] ✅ State: {done.get('state')}\n")
        else:
            raise

    # Get grade
    try:
        review = ws("mod_quiz_get_attempt_review", attemptid=attempt_id)
        grade = review.get("grade", "N/A")
        print(f"{'='*70}")
        print(f"  🎯 GRADE: {grade}")
        print(f"  💯 EXPECTED: 80.00 (4/5 correct)")
        print(f"{'='*70}\n")
        print(f"View in Moodle: {MOODLE_URL}/mod/quiz/view.php?id=46\n")
    except Exception as e:
        print(f"Review not available: {e}\n")

if __name__ == "__main__":
    main()
