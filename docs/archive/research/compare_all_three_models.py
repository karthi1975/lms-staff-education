#!/usr/bin/env python3
"""
3-Way Model Comparison: Claude vs Gemini vs Llama
Quality, Cost, Latency Analysis for Educational RAG System
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
print(f"{C.W}{C.G}🥊 THREE-WAY BATTLE: Claude vs Gemini vs Llama{C.E}")
print(f"{C.W}{C.G}Quality | Cost | Latency | Educational Suitability{C.E}")
print(f"{C.W}{C.G}{'='*100}{C.E}\n")

# Model configurations
MODELS = [
    {
        "name": "Llama-4 Maverick",
        "region": "us-east5",
        "distance_km": 12000,
        "publisher": "meta",
        "model_id": "llama-4-maverick-17b-128e-instruct-maas",
        "input_price": 0.20,
        "output_price": 0.20,
        "api_type": "vertex_standard"
    },
    {
        "name": "Gemini 2.5 Flash",
        "region": "europe-west1",
        "distance_km": 6500,
        "publisher": "google",
        "model_id": "gemini-2.5-flash",
        "input_price": 0.075,
        "output_price": 0.30,
        "api_type": "vertex_standard"
    },
    {
        "name": "Claude 3.5 Haiku",
        "region": "us-east5",
        "distance_km": 12000,
        "publisher": "anthropic",
        "model_id": "claude-3-5-haiku@20250219",
        "input_price": 1.00,
        "output_price": 5.00,
        "api_type": "vertex_claude"
    }
]

# Educational test scenarios
TESTS = [
    {
        "id": "simple_qa",
        "question": "What is effective teaching? Answer in 2-3 sentences.",
        "ideal_words": (30, 80),
        "keywords": ["student", "learning", "engage", "effective"]
    },
    {
        "id": "practical_strategy",
        "question": "How can a teacher handle a disruptive student without stopping the lesson? Give 2 strategies.",
        "ideal_words": (50, 120),
        "keywords": ["proximity", "signal", "non-verbal", "redirect", "strategy"]
    },
    {
        "id": "quiz_creation",
        "question": "Create a multiple-choice quiz question about classroom management with 4 options (A-D). Mark the correct answer.",
        "ideal_words": (40, 100),
        "keywords": ["a)", "b)", "c)", "d)", "correct", "answer"]
    },
    {
        "id": "concept_explanation",
        "question": "Explain differentiated instruction to a new teacher in simple terms.",
        "ideal_words": (40, 100),
        "keywords": ["student", "need", "adapt", "different", "individual"]
    },
    {
        "id": "complex_scenario",
        "question": "Design a lesson strategy for a class with students at 3 different reading levels.",
        "ideal_words": (80, 180),
        "keywords": ["group", "level", "differentiat", "scaffold", "activity"]
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
    """Call model with appropriate API format"""

    if model['api_type'] == 'vertex_claude':
        # Claude API format
        endpoint = f"https://{model['region']}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{model['region']}/publishers/{model['publisher']}/models/{model['model_id']}:streamRawPredict"

        data = {
            "anthropic_version": "vertex-2023-10-16",
            "messages": [{"role": "user", "content": question}],
            "max_tokens": 800,
            "temperature": 0.7
        }
    else:
        # Gemini/Llama format
        endpoint = f"https://{model['region']}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{model['region']}/publishers/{model['publisher']}/models/{model['model_id']}:generateContent"

        data = {
            "contents": [{"role": "user", "parts": [{"text": question}]}],
            "generationConfig": {
                "maxOutputTokens": 800,
                "temperature": 0.7
            }
        }

    try:
        start = time.time()
        resp = requests.post(endpoint, headers=headers, json=data, timeout=20)
        latency = (time.time() - start) * 1000

        if resp.status_code == 200:
            result = resp.json()

            answer = None
            tokens_in = 0
            tokens_out = 0
            tokens_thinking = 0

            if model['api_type'] == 'vertex_claude':
                # Claude response format
                if 'content' in result and result['content']:
                    answer = result['content'][0].get('text', '').strip()
                if 'usage' in result:
                    tokens_in = result['usage'].get('input_tokens', 0)
                    tokens_out = result['usage'].get('output_tokens', 0)
            else:
                # Gemini/Llama format
                usage = result.get('usageMetadata', {})
                tokens_thinking = usage.get('thoughtsTokenCount', 0)
                tokens_out = usage.get('candidatesTokenCount', 0)
                tokens_in = usage.get('promptTokenCount', 0)

                if 'candidates' in result and result['candidates']:
                    parts = result['candidates'][0].get('content', {}).get('parts', [])
                    if parts and 'text' in parts[0]:
                        answer = parts[0]['text'].strip()

            if answer:
                # Calculate cost
                total_input = tokens_in + tokens_thinking
                cost = (total_input * model['input_price'] / 1_000_000) + \
                       (tokens_out * model['output_price'] / 1_000_000)

                return {
                    "success": True,
                    "answer": answer,
                    "latency_ms": round(latency),
                    "tokens_in": tokens_in,
                    "tokens_out": tokens_out,
                    "tokens_thinking": tokens_thinking,
                    "cost_per_req": cost,
                    "cost_per_1k": cost * 1000,
                    "words": len(answer.split())
                }

        return {"success": False, "error": f"HTTP {resp.status_code}"}
    except Exception as e:
        return {"success": False, "error": str(e)[:50]}

def score_quality(answer, test):
    """Score response quality (0-100)"""
    text = answer.lower()
    words = len(answer.split())

    # Accuracy - keyword coverage
    found = sum(1 for kw in test['keywords'] if kw.lower() in text)
    accuracy = min(100, (found / len(test['keywords'])) * 100)

    # Completeness - ideal word range
    min_w, max_w = test['ideal_words']
    if words < min_w:
        completeness = (words / min_w) * 100
    elif words > max_w:
        completeness = max(60, 100 - ((words - max_w) / max_w) * 20)
    else:
        completeness = 100

    # Clarity - structure markers
    has_list = any(x in answer for x in ['1.', '2.', '•', '-', '*'])
    has_breaks = '\n' in answer
    has_options = 'a)' in text or 'b)' in text
    clarity = sum([has_list * 35, has_breaks * 25, has_options * 30, 30])
    clarity = min(100, clarity)

    # Relevance - educational context
    edu_words = ['student', 'teacher', 'learn', 'class', 'education', 'school']
    rel_found = sum(1 for w in edu_words if w in text)
    relevance = min(100, (rel_found / 2) * 100)

    # Overall confidence
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
all_results = []

for test in TESTS:
    print(f"\n{C.W}{C.B}{'─'*100}{C.E}")
    print(f"{C.W}TEST: {test['id'].upper()}{C.E}")
    print(f"{C.W}Q: {test['question']}{C.E}")
    print(f"{C.W}{C.B}{'─'*100}{C.E}\n")

    test_data = {"test": test['id'], "question": test['question'], "models": []}

    for model in MODELS:
        print(f"  {model['name']:<25}", end=" ")

        resp = call_model(model, test['question'])

        if resp['success']:
            scores = score_quality(resp['answer'], test)

            print(f"{C.G}✅{C.E} Q:{C.G}{scores['confidence']:.0f}%{C.E} ", end="")
            print(f"${resp['cost_per_1k']:>6.3f}/1k {resp['latency_ms']:>4}ms {resp['words']:>3}w")

            test_data['models'].append({
                "model": model['name'],
                "success": True,
                "scores": scores,
                "latency_ms": resp['latency_ms'],
                "cost_per_1k": resp['cost_per_1k'],
                "words": resp['words'],
                "tokens_thinking": resp['tokens_thinking'],
                "tokens_in": resp['tokens_in'],
                "tokens_out": resp['tokens_out'],
                "response": resp['answer'][:200]
            })
        else:
            print(f"{C.R}❌ {resp['error']}{C.E}")
            test_data['models'].append({
                "model": model['name'],
                "success": False,
                "error": resp.get('error', 'Unknown')
            })

    all_results.append(test_data)

# Aggregate scores
print(f"\n\n{C.W}{C.G}{'='*100}{C.E}")
print(f"{C.W}{C.G}📊 OVERALL COMPARISON{C.E}")
print(f"{C.W}{C.G}{'='*100}{C.E}\n")

aggregates = {}

for model in MODELS:
    aggregates[model['name']] = {
        "model_info": model,
        "scores": {"accuracy": [], "completeness": [], "clarity": [], "relevance": [], "confidence": []},
        "latency": [],
        "cost": [],
        "words": [],
        "success": 0
    }

for test_result in all_results:
    for model_result in test_result['models']:
        if model_result.get('success'):
            name = model_result['model']
            aggregates[name]['success'] += 1
            for k, v in model_result['scores'].items():
                aggregates[name]['scores'][k].append(v)
            aggregates[name]['latency'].append(model_result['latency_ms'])
            aggregates[name]['cost'].append(model_result['cost_per_1k'])
            aggregates[name]['words'].append(model_result['words'])

# Calculate final scores
final_scores = []

for name, data in aggregates.items():
    if data['success'] > 0:
        avg_scores = {k: sum(v) / len(v) for k, v in data['scores'].items()}
        final_scores.append({
            "model": name,
            "region": data['model_info']['region'],
            "distance_km": data['model_info']['distance_km'],
            "success_rate": (data['success'] / len(TESTS)) * 100,
            "avg_confidence": avg_scores['confidence'],
            "avg_accuracy": avg_scores['accuracy'],
            "avg_completeness": avg_scores['completeness'],
            "avg_clarity": avg_scores['clarity'],
            "avg_relevance": avg_scores['relevance'],
            "avg_latency_ms": sum(data['latency']) / len(data['latency']),
            "avg_cost_per_1k": sum(data['cost']) / len(data['cost']),
            "avg_words": sum(data['words']) / len(data['words']),
            "input_price": data['model_info']['input_price'],
            "output_price": data['model_info']['output_price']
        })

# Sort by confidence
final_scores.sort(key=lambda x: x['avg_confidence'], reverse=True)

# Print comparison table
print(f"{'Rank':<6} {'Model':<25} {'Quality':<10} {'Cost/1k':<10} {'Latency':<10} {'Words':<8} {'Success':<8}")
print("─" * 95)

for i, r in enumerate(final_scores, 1):
    color = C.G if i == 1 else C.Y if i == 2 else C.W
    print(f"{color}{i:<6} {r['model']:<25} {r['avg_confidence']:>6.1f}%    ${r['avg_cost_per_1k']:>7.4f}  {r['avg_latency_ms']:>6.0f}ms   {r['avg_words']:>5.0f}w   {r['success_rate']:>5.0f}%{C.E}")

# Detailed breakdown
print(f"\n{C.W}Quality Breakdown:{C.E}\n")
print(f"{'Model':<25} {'Accuracy':<10} {'Complete':<10} {'Clarity':<10} {'Relevance':<10}")
print("─" * 70)

for r in final_scores:
    print(f"{r['model']:<25} {r['avg_accuracy']:>6.1f}%    {r['avg_completeness']:>6.1f}%    {r['avg_clarity']:>6.1f}%    {r['avg_relevance']:>6.1f}%")

# Winner analysis
if final_scores:
    winner = final_scores[0]

    print(f"\n\n{C.W}{C.G}{'='*100}{C.E}")
    print(f"{C.W}{C.G}🏆 WINNER: {winner['model']}{C.E}")
    print(f"{C.W}{C.G}{'='*100}{C.E}\n")

    print(f"  {C.W}Quality Scores:{C.E}")
    print(f"    Overall Quality:  {C.G}{winner['avg_confidence']:.1f}%{C.E}")
    print(f"    Accuracy:         {winner['avg_accuracy']:.1f}%")
    print(f"    Completeness:     {winner['avg_completeness']:.1f}%")
    print(f"    Clarity:          {winner['avg_clarity']:.1f}%")
    print(f"    Relevance:        {winner['avg_relevance']:.1f}%")

    print(f"\n  {C.W}Performance:{C.E}")
    print(f"    Latency:          {winner['avg_latency_ms']:.0f}ms ({winner['avg_latency_ms']/1000:.1f}s)")
    print(f"    Cost per 1k:      ${winner['avg_cost_per_1k']:.4f}")
    print(f"    Response Length:  {winner['avg_words']:.0f} words")
    print(f"    Success Rate:     {winner['success_rate']:.0f}%")

    print(f"\n  {C.W}Location:{C.E}")
    print(f"    Region:           {winner['region']}")
    print(f"    Distance:         {winner['distance_km']:,} km from Tanzania")

    # Cost projections
    print(f"\n  {C.W}Annual Cost Projections:{C.E}")
    for scale in [10_000, 100_000, 1_000_000, 10_000_000]:
        cost = winner['avg_cost_per_1k'] * scale / 1000
        print(f"    {scale:>10,} requests: ${cost:>8,.2f}")

    # Comparison with others
    if len(final_scores) >= 2:
        print(f"\n  {C.W}vs Runner-up ({final_scores[1]['model']}):{C.E}")
        quality_diff = winner['avg_confidence'] - final_scores[1]['avg_confidence']
        cost_diff = ((final_scores[1]['avg_cost_per_1k'] - winner['avg_cost_per_1k']) / final_scores[1]['avg_cost_per_1k']) * 100
        lat_diff = ((final_scores[1]['avg_latency_ms'] - winner['avg_latency_ms']) / final_scores[1]['avg_latency_ms']) * 100

        print(f"    Quality advantage:  {C.G}+{quality_diff:.1f}%{C.E}")
        if cost_diff > 0:
            print(f"    Cost advantage:     {C.G}{cost_diff:.0f}% cheaper{C.E}")
        else:
            print(f"    Cost difference:    {abs(cost_diff):.0f}% more expensive")
        if lat_diff > 0:
            print(f"    Speed advantage:    {C.G}{lat_diff:.0f}% faster{C.E}")
        else:
            print(f"    Speed difference:   {abs(lat_diff):.0f}% slower")

# Save results
output = {
    "test_time": datetime.now().isoformat(),
    "models_tested": [m['name'] for m in MODELS],
    "test_count": len(TESTS),
    "final_scores": final_scores,
    "detailed_results": all_results,
    "winner": {
        "model": winner['model'],
        "quality": winner['avg_confidence'],
        "cost_per_1k": winner['avg_cost_per_1k'],
        "latency_ms": winner['avg_latency_ms']
    } if final_scores else None
}

filename = f"3way_comparison_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
with open(filename, 'w') as f:
    json.dump(output, f, indent=2)

print(f"\n{C.G}💾 Detailed results: {filename}{C.E}")

print(f"\n{C.W}{C.C}{'='*100}{C.E}")
print(f"{C.W}{C.C}✨ Three-Way Comparison Complete{C.E}")
print(f"{C.W}{C.C}{'='*100}{C.E}\n")
