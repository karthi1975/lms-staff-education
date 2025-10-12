#!/usr/bin/env python3
"""
Quality Confidence Validator: Llama vs Gemini
Educational Content Quality Scoring
"""

import os
import time
import json
from datetime import datetime
from dotenv import load_dotenv
import google.auth
from google.auth.transport.requests import Request
import requests

load_dotenv()

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "lms-tanzania-consultant")

# Colors
class C:
    G = '\033[92m'; R = '\033[91m'; Y = '\033[93m'; B = '\033[94m'
    C = '\033[96m'; M = '\033[95m'; W = '\033[1m'; E = '\033[0m'

print(f"\n{C.W}{C.G}{'='*100}{C.E}")
print(f"{C.W}{C.G}🎯 QUALITY CONFIDENCE VALIDATOR: Llama vs Gemini{C.E}")
print(f"{C.W}{C.G}{'='*100}{C.E}\n")

# Model configurations
MODELS = [
    {
        "name": "Llama-4 Maverick",
        "region": "us-east5",
        "publisher": "meta",
        "model_id": "llama-4-maverick-17b-128e-instruct-maas"
    },
    {
        "name": "Gemini 2.5 Flash",
        "region": "europe-west1",
        "publisher": "google",
        "model_id": "gemini-2.5-flash"
    }
]

# Quality test cases
TESTS = [
    {
        "id": "factual",
        "q": "What are the 3 main learning theories in education?",
        "keywords": ["behaviorism", "cognitivism", "constructivism"],
        "ideal_words": (30, 100)
    },
    {
        "id": "practical",
        "q": "How can a teacher handle a disruptive student without stopping the lesson?",
        "keywords": ["proximity", "signal", "redirect", "non-verbal"],
        "ideal_words": (50, 150)
    },
    {
        "id": "quiz",
        "q": "Create a multiple-choice quiz question about classroom management with 4 options (A-D). Mark the correct answer.",
        "keywords": ["a)", "b)", "c)", "d)", "correct"],
        "ideal_words": (40, 100)
    },
    {
        "id": "explanation",
        "q": "Explain differentiated instruction to a new teacher in 2-3 sentences.",
        "keywords": ["student", "need", "adapt", "individual"],
        "ideal_words": (30, 80)
    },
    {
        "id": "strategy",
        "q": "A teacher has students at 3 reading levels. Suggest 2 strategies to engage all levels.",
        "keywords": ["group", "level", "differentiat", "scaffold"],
        "ideal_words": (60, 150)
    }
]

print(f"{C.C}🔐 Authenticating...{C.E}")
credentials, _ = google.auth.default()
auth_req = Request()
credentials.refresh(auth_req)
headers = {
    "Authorization": f"Bearer {credentials.token}",
    "Content-Type": "application/json"
}
print(f"{C.G}✅ Authenticated{C.E}\n")

def call_model(model, question):
    """Call model and return response"""
    endpoint = f"https://{model['region']}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{model['region']}/publishers/{model['publisher']}/models/{model['model_id']}:generateContent"

    data = {
        "contents": [{"role": "user", "parts": [{"text": question}]}],
        "generationConfig": {"maxOutputTokens": 1000, "temperature": 0.7}
    }

    try:
        start = time.time()
        resp = requests.post(endpoint, headers=headers, json=data, timeout=20)
        latency = (time.time() - start) * 1000

        if resp.status_code == 200:
            result = resp.json()
            usage = result.get('usageMetadata', {})

            answer = None
            if 'candidates' in result and result['candidates']:
                parts = result['candidates'][0].get('content', {}).get('parts', [])
                if parts and 'text' in parts[0]:
                    answer = parts[0]['text'].strip()

            if answer:
                return {
                    "success": True,
                    "answer": answer,
                    "latency_ms": round(latency),
                    "tokens_think": usage.get('thoughtsTokenCount', 0),
                    "tokens_out": usage.get('candidatesTokenCount', 0),
                    "words": len(answer.split())
                }

        return {"success": False, "error": f"HTTP {resp.status_code}"}
    except Exception as e:
        return {"success": False, "error": str(e)[:40]}

def score_quality(answer, test):
    """Score on 5 dimensions (0-100 each)"""
    text = answer.lower()
    words = len(answer.split())

    # 1. ACCURACY - keyword coverage
    found = sum(1 for kw in test['keywords'] if kw.lower() in text)
    accuracy = min(100, (found / len(test['keywords'])) * 100)

    # 2. COMPLETENESS - word count in ideal range
    min_w, max_w = test['ideal_words']
    if words < min_w:
        completeness = (words / min_w) * 100
    elif words > max_w:
        completeness = max(60, 100 - ((words - max_w) / max_w) * 20)
    else:
        completeness = 100

    # 3. CLARITY - structure markers
    has_list = any(x in answer for x in ['1.', '2.', '•', '-'])
    has_breaks = '\n' in answer
    has_options = 'a)' in text or 'b)' in text
    clarity = sum([has_list * 40, has_breaks * 30, has_options * 30, 30])  # Base 30
    clarity = min(100, clarity)

    # 4. RELEVANCE - educational keywords
    edu_words = ['student', 'teacher', 'learn', 'class', 'education']
    rel_found = sum(1 for w in edu_words if w in text)
    relevance = min(100, (rel_found / 2) * 100)  # Need at least 2

    # 5. CONFIDENCE - weighted avg
    confidence = (
        accuracy * 0.35 +
        completeness * 0.25 +
        clarity * 0.20 +
        relevance * 0.20
    )

    return {
        "accuracy": round(accuracy, 1),
        "completeness": round(completeness, 1),
        "clarity": round(clarity, 1),
        "relevance": round(relevance, 1),
        "confidence": round(confidence, 1)
    }

# Run tests
results = []

for test in TESTS:
    print(f"\n{C.W}{C.B}{'─'*100}{C.E}")
    print(f"{C.W}TEST: {test['id'].upper()}{C.E}")
    print(f"{C.W}Q: {test['q']}{C.E}")
    print(f"{C.W}{C.B}{'─'*100}{C.E}\n")

    test_data = {"test": test['id'], "models": []}

    for model in MODELS:
        print(f"  {model['name']:<25}", end=" ")

        resp = call_model(model, test['q'])

        if resp['success']:
            scores = score_quality(resp['answer'], test)

            print(f"{C.G}✅{C.E} Conf:{C.G}{scores['confidence']:.0f}%{C.E} ", end="")
            print(f"Acc:{scores['accuracy']:.0f}% Comp:{scores['completeness']:.0f}% Clar:{scores['clarity']:.0f}% Rel:{scores['relevance']:.0f}%")

            test_data['models'].append({
                "model": model['name'],
                "success": True,
                "scores": scores,
                "latency": resp['latency_ms'],
                "words": resp['words'],
                "thinking": resp['tokens_think'],
                "response": resp['answer'][:150]
            })
        else:
            print(f"{C.R}❌ {resp['error']}{C.E}")
            test_data['models'].append({"model": model['name'], "success": False})

    results.append(test_data)

# Aggregate scores
print(f"\n\n{C.W}{C.G}{'='*100}{C.E}")
print(f"{C.W}{C.G}📊 OVERALL QUALITY SCORES{C.E}")
print(f"{C.W}{C.G}{'='*100}{C.E}\n")

aggregates = {}

for model in MODELS:
    aggregates[model['name']] = {
        "scores": {"accuracy": [], "completeness": [], "clarity": [], "relevance": [], "confidence": []},
        "latency": [],
        "words": [],
        "success": 0
    }

for test_result in results:
    for model_result in test_result['models']:
        if model_result['success']:
            name = model_result['model']
            aggregates[name]['success'] += 1
            for k, v in model_result['scores'].items():
                aggregates[name]['scores'][k].append(v)
            aggregates[name]['latency'].append(model_result['latency'])
            aggregates[name]['words'].append(model_result['words'])

# Calculate averages
final = []

for name, data in aggregates.items():
    if data['success'] > 0:
        avg_scores = {k: sum(v) / len(v) for k, v in data['scores'].items()}
        final.append({
            "model": name,
            "success_rate": (data['success'] / len(TESTS)) * 100,
            "avg_confidence": avg_scores['confidence'],
            "avg_accuracy": avg_scores['accuracy'],
            "avg_completeness": avg_scores['completeness'],
            "avg_clarity": avg_scores['clarity'],
            "avg_relevance": avg_scores['relevance'],
            "avg_latency": sum(data['latency']) / len(data['latency']),
            "avg_words": sum(data['words']) / len(data['words'])
        })

final.sort(key=lambda x: x['avg_confidence'], reverse=True)

# Print results
print(f"{'Rank':<6} {'Model':<25} {'Confidence':<12} {'Accuracy':<10} {'Complete':<10} {'Clarity':<10} {'Relevance':<10}")
print("─" * 85)

for i, r in enumerate(final, 1):
    color = C.G if i == 1 else C.Y
    print(f"{color}{i:<6} {r['model']:<25} {r['avg_confidence']:>6.1f}%      ", end="")
    print(f"{r['avg_accuracy']:>6.1f}%    {r['avg_completeness']:>6.1f}%    ", end="")
    print(f"{r['avg_clarity']:>6.1f}%    {r['avg_relevance']:>6.1f}%{C.E}")

if final:
    winner = final[0]

    print(f"\n\n{C.W}{C.G}🏆 WINNER: {winner['model']}{C.E}\n")
    print(f"  Overall Confidence: {C.G}{winner['avg_confidence']:.1f}%{C.E}")
    print(f"  Success Rate: {winner['success_rate']:.0f}%")
    print(f"  Avg Latency: {winner['avg_latency']:.0f}ms")
    print(f"  Avg Response: {winner['avg_words']:.0f} words\n")

    print(f"  {C.W}Quality Breakdown:{C.E}")
    print(f"    Accuracy:     {winner['avg_accuracy']:.1f}%")
    print(f"    Completeness: {winner['avg_completeness']:.1f}%")
    print(f"    Clarity:      {winner['avg_clarity']:.1f}%")
    print(f"    Relevance:    {winner['avg_relevance']:.1f}%")

    if len(final) >= 2:
        runner = final[1]
        diff = winner['avg_confidence'] - runner['avg_confidence']
        print(f"\n  {C.W}vs {runner['model']}:{C.E}")
        print(f"    Confidence advantage: {C.G}+{diff:.1f}%{C.E}")

# Save
output = {
    "test_time": datetime.now().isoformat(),
    "models": [m['name'] for m in MODELS],
    "test_count": len(TESTS),
    "final_scores": final,
    "detailed_results": results
}

filename = f"quality_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
with open(filename, 'w') as f:
    json.dump(output, f, indent=2)

print(f"\n{C.G}💾 Report: {filename}{C.E}")
print(f"\n{C.W}{C.C}{'='*100}{C.E}")
print(f"{C.W}{C.C}✨ Complete{C.E}")
print(f"{C.W}{C.C}{'='*100}{C.E}\n")
