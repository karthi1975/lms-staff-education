#!/usr/bin/env python3
"""
Quality & Confidence Score Validator
Compare Llama, Gemini, and Claude on educational content quality
Scoring: Accuracy, Completeness, Clarity, Relevance, Confidence
"""

import os
import time
import json
import re
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
print(f"{C.W}{C.G}🎯 QUALITY & CONFIDENCE VALIDATOR{C.E}")
print(f"{C.W}{C.G}Comparing: Llama-4 | Gemini 2.5 Flash | Claude 3.5 Haiku{C.E}")
print(f"{C.W}{C.G}{'='*100}{C.E}\n")

# Model configurations
MODELS = [
    {
        "name": "Llama-4 Maverick",
        "region": "us-east5",
        "publisher": "meta",
        "model_id": "llama-4-maverick-17b-128e-instruct-maas",
        "type": "standard",
        "endpoint_type": "generateContent"
    },
    {
        "name": "Gemini 2.5 Flash",
        "region": "europe-west1",
        "publisher": "google",
        "model_id": "gemini-2.5-flash",
        "type": "reasoning",
        "endpoint_type": "generateContent"
    },
    {
        "name": "Claude 3.5 Haiku",
        "region": "us-east5",
        "publisher": "anthropic",
        "model_id": "claude-3-5-haiku@20250219",
        "type": "premium",
        "endpoint_type": "streamRawPredict"
    }
]

# Quality test cases with expected criteria
QUALITY_TESTS = [
    {
        "id": "factual_knowledge",
        "question": "What are the 3 main learning theories in education?",
        "expected_keywords": ["behaviorism", "cognitivism", "constructivism"],
        "expected_structure": "list",
        "ideal_length_words": (30, 100),
        "scoring": {
            "accuracy": "mentions all 3 theories",
            "completeness": "brief explanation of each",
            "clarity": "clear list format",
            "relevance": "educational context"
        }
    },
    {
        "id": "practical_application",
        "question": "How can a teacher handle a disruptive student without stopping the lesson?",
        "expected_keywords": ["proximity", "signal", "redirect", "strategy", "non-verbal"],
        "expected_structure": "practical_steps",
        "ideal_length_words": (50, 150),
        "scoring": {
            "accuracy": "evidence-based strategies",
            "completeness": "multiple strategies",
            "clarity": "actionable steps",
            "relevance": "classroom applicable"
        }
    },
    {
        "id": "quiz_generation",
        "question": "Create a multiple-choice quiz question about Bloom's Taxonomy with 4 options (A-D), mark the correct answer.",
        "expected_keywords": ["bloom", "taxonomy", "correct:", "a)", "b)", "c)", "d)"],
        "expected_structure": "quiz_format",
        "ideal_length_words": (40, 100),
        "scoring": {
            "accuracy": "correct Bloom's content",
            "completeness": "4 options + answer",
            "clarity": "clear question format",
            "relevance": "appropriate difficulty"
        }
    },
    {
        "id": "concept_explanation",
        "question": "Explain differentiated instruction to a new teacher in 2-3 sentences.",
        "expected_keywords": ["student", "need", "adapt", "individual", "learning"],
        "expected_structure": "explanation",
        "ideal_length_words": (30, 80),
        "scoring": {
            "accuracy": "correct definition",
            "completeness": "key components",
            "clarity": "simple language",
            "relevance": "practical focus"
        }
    },
    {
        "id": "complex_scenario",
        "question": "A teacher has students at 3 different reading levels in one class. Design a lesson strategy that engages all levels simultaneously.",
        "expected_keywords": ["group", "differentiat", "scaffold", "level", "activity"],
        "expected_structure": "strategy",
        "ideal_length_words": (80, 200),
        "scoring": {
            "accuracy": "pedagogically sound",
            "completeness": "addresses all 3 levels",
            "clarity": "step-by-step approach",
            "relevance": "realistic implementation"
        }
    },
    {
        "id": "assessment_creation",
        "question": "Write 2 formative assessment questions for a lesson on fractions (Grade 5).",
        "expected_keywords": ["fraction", "understand", "assess", "question"],
        "expected_structure": "questions",
        "ideal_length_words": (20, 80),
        "scoring": {
            "accuracy": "age-appropriate",
            "completeness": "2 questions",
            "clarity": "clear wording",
            "relevance": "formative purpose"
        }
    }
]

# Authenticate
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
    """Call a model and return response with metrics"""

    if model['endpoint_type'] == 'generateContent':
        endpoint = f"https://{model['region']}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{model['region']}/publishers/{model['publisher']}/models/{model['model_id']}:generateContent"

        data = {
            "contents": [{"role": "user", "parts": [{"text": question}]}],
            "generationConfig": {
                "maxOutputTokens": 1000,
                "temperature": 0.7
            }
        }
    else:  # Claude
        endpoint = f"https://{model['region']}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{model['region']}/publishers/{model['publisher']}/models/{model['model_id']}:streamRawPredict"

        data = {
            "anthropic_version": "vertex-2023-10-16",
            "messages": [{"role": "user", "content": question}],
            "max_tokens": 1000,
            "temperature": 0.7
        }

    try:
        start = time.time()
        resp = requests.post(endpoint, headers=headers, json=data, timeout=20)
        latency = (time.time() - start) * 1000

        if resp.status_code == 200:
            result = resp.json()

            # Extract response based on model type
            answer = None
            tokens_in = 0
            tokens_out = 0
            tokens_thinking = 0

            if model['endpoint_type'] == 'generateContent':
                # Gemini/Llama format
                usage = result.get('usageMetadata', {})
                tokens_thinking = usage.get('thoughtsTokenCount', 0)
                tokens_out = usage.get('candidatesTokenCount', 0)
                tokens_in = usage.get('promptTokenCount', 0)

                if 'candidates' in result and result['candidates']:
                    parts = result['candidates'][0].get('content', {}).get('parts', [])
                    if parts and 'text' in parts[0]:
                        answer = parts[0]['text'].strip()
            else:
                # Claude format
                if 'content' in result and result['content']:
                    answer = result['content'][0].get('text', '').strip()
                if 'usage' in result:
                    tokens_in = result['usage'].get('input_tokens', 0)
                    tokens_out = result['usage'].get('output_tokens', 0)

            if answer:
                return {
                    "success": True,
                    "answer": answer,
                    "latency_ms": round(latency),
                    "tokens_in": tokens_in,
                    "tokens_out": tokens_out,
                    "tokens_thinking": tokens_thinking,
                    "word_count": len(answer.split())
                }
            else:
                return {"success": False, "error": "No output"}
        else:
            return {"success": False, "error": f"HTTP {resp.status_code}"}

    except Exception as e:
        return {"success": False, "error": str(e)[:50]}

def score_response(response, test):
    """Score response on multiple quality dimensions (0-100 each)"""

    answer = response['answer'].lower()
    word_count = response['word_count']

    scores = {}

    # 1. ACCURACY (keyword matching)
    keywords_found = sum(1 for kw in test['expected_keywords'] if kw.lower() in answer)
    accuracy = min(100, (keywords_found / len(test['expected_keywords'])) * 100)
    scores['accuracy'] = round(accuracy, 1)

    # 2. COMPLETENESS (length appropriate)
    min_words, max_words = test['ideal_length_words']
    if word_count < min_words:
        completeness = (word_count / min_words) * 100
    elif word_count > max_words:
        completeness = max(60, 100 - ((word_count - max_words) / max_words) * 20)
    else:
        completeness = 100
    scores['completeness'] = round(completeness, 1)

    # 3. CLARITY (structure markers)
    clarity_markers = 0
    if test['expected_structure'] == 'list':
        clarity_markers += 30 if any(x in answer for x in ['1.', '2.', '3.', '•', '-']) else 0
        clarity_markers += 30 if '\n' in response['answer'] else 0
        clarity_markers += 40 if len(response['answer'].split('\n')) >= 3 else 0
    elif test['expected_structure'] == 'quiz_format':
        clarity_markers += 25 if 'a)' in answer or 'a.' in answer else 0
        clarity_markers += 25 if 'b)' in answer or 'b.' in answer else 0
        clarity_markers += 25 if 'c)' in answer or 'c.' in answer else 0
        clarity_markers += 25 if 'correct' in answer or 'answer' in answer else 0
    elif test['expected_structure'] == 'questions':
        clarity_markers += 50 if '?' in answer else 0
        clarity_markers += 50 if answer.count('?') >= 2 else 0
    else:
        clarity_markers = 70  # Default for explanations

    scores['clarity'] = round(min(100, clarity_markers), 1)

    # 4. RELEVANCE (educational context)
    edu_keywords = ['student', 'teacher', 'learn', 'class', 'teach', 'education', 'school']
    relevance_found = sum(1 for kw in edu_keywords if kw in answer)
    relevance = min(100, (relevance_found / 3) * 100)  # Expect at least 3
    scores['relevance'] = round(relevance, 1)

    # 5. CONFIDENCE (overall quality)
    # Weighted average: accuracy 30%, completeness 25%, clarity 25%, relevance 20%
    confidence = (
        scores['accuracy'] * 0.30 +
        scores['completeness'] * 0.25 +
        scores['clarity'] * 0.25 +
        scores['relevance'] * 0.20
    )
    scores['confidence'] = round(confidence, 1)

    return scores

# Run tests
all_results = []

for test in QUALITY_TESTS:
    print(f"\n{C.W}{C.B}{'─'*100}{C.E}")
    print(f"{C.W}Test: {test['id'].upper()}{C.E}")
    print(f"{C.W}Q: {test['question']}{C.E}")
    print(f"{C.W}{C.B}{'─'*100}{C.E}\n")

    test_results = {"test": test['id'], "question": test['question'], "models": []}

    for model in MODELS:
        print(f"  {model['name']:<25}", end=" ")

        response = call_model(model, test['question'])

        if response['success']:
            scores = score_response(response, test)

            print(f"{C.G}✅{C.E} Confidence: {C.G}{scores['confidence']:.0f}%{C.E} ", end="")
            print(f"(A:{scores['accuracy']:.0f} C:{scores['completeness']:.0f} Cl:{scores['clarity']:.0f} R:{scores['relevance']:.0f})")

            test_results['models'].append({
                "model": model['name'],
                "success": True,
                "scores": scores,
                "latency_ms": response['latency_ms'],
                "word_count": response['word_count'],
                "tokens_thinking": response['tokens_thinking'],
                "response": response['answer'][:200]
            })
        else:
            print(f"{C.R}❌ {response['error']}{C.E}")
            test_results['models'].append({
                "model": model['name'],
                "success": False,
                "error": response['error']
            })

    all_results.append(test_results)

# Calculate overall scores
print(f"\n\n{C.W}{C.G}{'='*100}{C.E}")
print(f"{C.W}{C.G}📊 OVERALL QUALITY SCORES{C.E}")
print(f"{C.W}{C.G}{'='*100}{C.E}\n")

model_aggregates = {}

for model in MODELS:
    model_name = model['name']
    model_aggregates[model_name] = {
        "total_tests": 0,
        "successful_tests": 0,
        "scores": {
            "accuracy": [],
            "completeness": [],
            "clarity": [],
            "relevance": [],
            "confidence": []
        },
        "avg_latency": [],
        "avg_words": []
    }

# Aggregate scores
for test_result in all_results:
    for model_result in test_result['models']:
        if model_result['success']:
            model_name = model_result['model']
            model_aggregates[model_name]['total_tests'] += 1
            model_aggregates[model_name]['successful_tests'] += 1

            for score_type, score_value in model_result['scores'].items():
                model_aggregates[model_name]['scores'][score_type].append(score_value)

            model_aggregates[model_name]['avg_latency'].append(model_result['latency_ms'])
            model_aggregates[model_name]['avg_words'].append(model_result['word_count'])

# Calculate averages and print
final_scores = []

for model_name, data in model_aggregates.items():
    if data['successful_tests'] > 0:
        avg_scores = {
            "accuracy": sum(data['scores']['accuracy']) / len(data['scores']['accuracy']),
            "completeness": sum(data['scores']['completeness']) / len(data['scores']['completeness']),
            "clarity": sum(data['scores']['clarity']) / len(data['scores']['clarity']),
            "relevance": sum(data['scores']['relevance']) / len(data['scores']['relevance']),
            "confidence": sum(data['scores']['confidence']) / len(data['scores']['confidence'])
        }

        final_scores.append({
            "model": model_name,
            "success_rate": (data['successful_tests'] / len(QUALITY_TESTS)) * 100,
            "scores": avg_scores,
            "avg_latency": sum(data['avg_latency']) / len(data['avg_latency']),
            "avg_words": sum(data['avg_words']) / len(data['avg_words'])
        })

# Sort by confidence score
final_scores.sort(key=lambda x: x['scores']['confidence'], reverse=True)

# Print detailed scores
print(f"{C.W}Model Rankings (by Confidence Score):{C.E}\n")
print(f"{'Rank':<6} {'Model':<25} {'Confidence':<12} {'Accuracy':<10} {'Complete':<10} {'Clarity':<10} {'Relevance':<10}")
print("─" * 95)

for rank, result in enumerate(final_scores, 1):
    conf = result['scores']['confidence']
    acc = result['scores']['accuracy']
    comp = result['scores']['completeness']
    clar = result['scores']['clarity']
    rel = result['scores']['relevance']

    color = C.G if rank == 1 else C.Y if rank == 2 else C.W

    print(f"{color}{rank:<6} {result['model']:<25} {conf:>6.1f}%      {acc:>6.1f}%    {comp:>6.1f}%    {clar:>6.1f}%    {rel:>6.1f}%{C.E}")

# Winner analysis
print(f"\n\n{C.W}{C.G}🏆 WINNER: {final_scores[0]['model']}{C.E}\n")

winner = final_scores[0]
print(f"  Overall Confidence Score: {C.G}{winner['scores']['confidence']:.1f}%{C.E}")
print(f"  Success Rate: {winner['success_rate']:.0f}%")
print(f"  Average Latency: {winner['avg_latency']:.0f}ms")
print(f"  Average Response: {winner['avg_words']:.0f} words")

print(f"\n  {C.W}Dimension Scores:{C.E}")
print(f"    • Accuracy:     {winner['scores']['accuracy']:.1f}%")
print(f"    • Completeness: {winner['scores']['completeness']:.1f}%")
print(f"    • Clarity:      {winner['scores']['clarity']:.1f}%")
print(f"    • Relevance:    {winner['scores']['relevance']:.1f}%")

# Comparison
if len(final_scores) >= 2:
    print(f"\n{C.W}Comparison with Runner-up ({final_scores[1]['model']}):{C.E}")
    diff = winner['scores']['confidence'] - final_scores[1]['scores']['confidence']
    print(f"  Confidence advantage: {C.G}+{diff:.1f}%{C.E}")

# Save results
output = {
    "test_time": datetime.now().isoformat(),
    "test_count": len(QUALITY_TESTS),
    "models_tested": [m['name'] for m in MODELS],
    "quality_dimensions": ["accuracy", "completeness", "clarity", "relevance", "confidence"],
    "final_scores": final_scores,
    "detailed_results": all_results,
    "winner": {
        "model": winner['model'],
        "confidence_score": winner['scores']['confidence'],
        "recommendation": "Best for educational content quality"
    }
}

filename = f"quality_validation_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
with open(filename, 'w') as f:
    json.dump(output, f, indent=2)

print(f"\n{C.G}💾 Detailed results: {filename}{C.E}")

print(f"\n{C.W}{C.C}{'='*100}{C.E}")
print(f"{C.W}{C.C}✨ Quality Validation Complete{C.E}")
print(f"{C.W}{C.C}{'='*100}{C.E}\n")
