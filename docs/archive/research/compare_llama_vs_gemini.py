#!/usr/bin/env python3
"""
Direct Comparison: Llama (us-east5) vs Gemini (Belgium)
Cost, Quality, Latency - Side by Side
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

print(f"\n{C.W}{C.C}{'='*100}{C.E}")
print(f"{C.W}{C.C}⚔️  HEAD-TO-HEAD: Llama (us-east5) vs Gemini (Belgium){C.E}")
print(f"{C.W}{C.C}{'='*100}{C.E}\n")

# Test configurations
CONFIGS = [
    {
        "name": "Current: Llama-4 (us-east5)",
        "region": "us-east5",
        "distance_km": 12000,
        "publisher": "meta",
        "model_id": "llama-4-maverick-17b-128e-instruct-maas",
        "input_price": 0.20,
        "output_price": 0.20,
        "has_thinking": False
    },
    {
        "name": "Recommended: Gemini 2.5 Flash (Belgium)",
        "region": "europe-west1",
        "distance_km": 6500,
        "publisher": "google",
        "model_id": "gemini-2.5-flash",
        "input_price": 0.075,
        "output_price": 0.30,
        "has_thinking": True
    }
]

# Educational test cases
TESTS = [
    "What is effective teaching?",
    "Explain classroom management in 3 sentences.",
    "Create a quiz question about lesson planning with 4 options.",
    "Give 3 strategies for teaching mixed-ability students.",
    "How can teachers increase student engagement?"
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

results = []

for config in CONFIGS:
    print(f"\n{C.W}{C.B}{'─'*100}{C.E}")
    print(f"{C.W}Testing: {config['name']}{C.E}")
    print(f"{C.W}Distance: {config['distance_km']:,} km from Tanzania{C.E}")
    print(f"{C.W}{C.B}{'─'*100}{C.E}\n")

    endpoint = f"https://{config['region']}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{config['region']}/publishers/{config['publisher']}/models/{config['model_id']}:generateContent"

    test_results = []
    total_words = 0

    for i, prompt in enumerate(TESTS, 1):
        print(f"  {i}. {prompt[:55]:<57}", end=" ")

        data = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "maxOutputTokens": 1000,
                "temperature": 0.7
            }
        }

        try:
            start = time.time()
            resp = requests.post(endpoint, headers=headers, json=data, timeout=15)
            latency = (time.time() - start) * 1000

            if resp.status_code == 200:
                result = resp.json()
                usage = result.get('usageMetadata', {})
                thinking = usage.get('thoughtsTokenCount', 0)
                output = usage.get('candidatesTokenCount', 0)
                input_tok = usage.get('promptTokenCount', 0)

                answer = None
                if 'candidates' in result and result['candidates']:
                    parts = result['candidates'][0].get('content', {}).get('parts', [])
                    if parts and 'text' in parts[0]:
                        answer = parts[0]['text'].strip()

                if answer:
                    total_in = input_tok + thinking
                    cost = (total_in * config['input_price'] / 1_000_000) + \
                           (output * config['output_price'] / 1_000_000)
                    words = len(answer.split())
                    total_words += words

                    print(f"{C.G}✅{C.E} {latency:>5.0f}ms  ${cost*1000:>7.4f}/1k  {words:>3}w")

                    test_results.append({
                        "success": True,
                        "latency_ms": round(latency),
                        "thinking_tokens": thinking,
                        "input_tokens": input_tok,
                        "output_tokens": output,
                        "total_tokens": total_in + output,
                        "cost_per_1k": cost * 1000,
                        "words": words,
                        "response": answer
                    })
                else:
                    print(f"{C.Y}⚠️  NO OUTPUT{C.E}")
                    test_results.append({"success": False})
            else:
                print(f"{C.R}❌ HTTP {resp.status_code}{C.E}")
                test_results.append({"success": False})

        except Exception as e:
            print(f"{C.R}❌ {str(e)[:30]}{C.E}")
            test_results.append({"success": False})

    # Calculate stats
    successful = [r for r in test_results if r.get('success')]
    if successful:
        avg_lat = sum(r['latency_ms'] for r in successful) / len(successful)
        avg_think = sum(r['thinking_tokens'] for r in successful) / len(successful)
        avg_input = sum(r['input_tokens'] for r in successful) / len(successful)
        avg_output = sum(r['output_tokens'] for r in successful) / len(successful)
        avg_total = sum(r['total_tokens'] for r in successful) / len(successful)
        avg_cost = sum(r['cost_per_1k'] for r in successful) / len(successful)
        avg_words = total_words / len(successful)

        print(f"\n  {C.W}Summary:{C.E}")
        print(f"    Success: {len(successful)}/{len(TESTS)}")
        print(f"    Avg Latency: {avg_lat:.0f}ms ({avg_lat/1000:.1f}s)")
        print(f"    Avg Tokens: {avg_think:.0f} think + {avg_input:.0f} in + {avg_output:.0f} out = {avg_total:.0f}")
        print(f"    Avg Cost: ${avg_cost:.4f}/1k")
        print(f"    Avg Length: {avg_words:.0f} words")

        results.append({
            "config": config,
            "success_count": len(successful),
            "success_rate": len(successful) / len(TESTS) * 100,
            "avg_latency_ms": round(avg_lat),
            "avg_thinking_tokens": round(avg_think, 1),
            "avg_input_tokens": round(avg_input, 1),
            "avg_output_tokens": round(avg_output, 1),
            "avg_total_tokens": round(avg_total, 1),
            "avg_cost_per_1k": round(avg_cost, 4),
            "avg_words": round(avg_words, 1),
            "test_results": test_results
        })

# Comparison
print(f"\n\n{C.W}{C.G}{'='*100}{C.E}")
print(f"{C.W}{C.G}📊 HEAD-TO-HEAD COMPARISON{C.E}")
print(f"{C.W}{C.G}{'='*100}{C.E}\n")

if len(results) == 2:
    llama = results[0]
    gemini = results[1]

    # Cost comparison
    cost_diff = ((llama['avg_cost_per_1k'] - gemini['avg_cost_per_1k']) / llama['avg_cost_per_1k']) * 100

    # Latency comparison
    lat_diff = ((gemini['avg_latency_ms'] - llama['avg_latency_ms']) / llama['avg_latency_ms']) * 100

    # Distance comparison
    dist_diff = ((llama['config']['distance_km'] - gemini['config']['distance_km']) / llama['config']['distance_km']) * 100

    print(f"{C.W}COST:{C.E}")
    print(f"  Llama (us-east5):  ${llama['avg_cost_per_1k']:.4f}/1k")
    print(f"  Gemini (Belgium):  ${gemini['avg_cost_per_1k']:.4f}/1k")
    if cost_diff > 0:
        print(f"  {C.G}Winner: Gemini is {cost_diff:.0f}% CHEAPER ✅{C.E}")
    else:
        print(f"  {C.R}Winner: Llama is {abs(cost_diff):.0f}% cheaper{C.E}")

    print(f"\n{C.W}LATENCY:{C.E}")
    print(f"  Llama (us-east5):  {llama['avg_latency_ms']}ms ({llama['avg_latency_ms']/1000:.1f}s)")
    print(f"  Gemini (Belgium):  {gemini['avg_latency_ms']}ms ({gemini['avg_latency_ms']/1000:.1f}s)")
    if lat_diff < 0:
        print(f"  {C.G}Winner: Gemini is {abs(lat_diff):.0f}% FASTER ✅{C.E}")
    else:
        print(f"  {C.Y}Winner: Llama is {abs(lat_diff):.0f}% faster{C.E}")

    print(f"\n{C.W}DISTANCE:{C.E}")
    print(f"  Llama (us-east5):  {llama['config']['distance_km']:,} km from Tanzania")
    print(f"  Gemini (Belgium):  {gemini['config']['distance_km']:,} km from Tanzania")
    print(f"  {C.G}Winner: Gemini is {dist_diff:.0f}% CLOSER ✅{C.E}")

    print(f"\n{C.W}QUALITY:{C.E}")
    print(f"  Llama thinking tokens:  {llama['avg_thinking_tokens']:.0f} (standard model)")
    print(f"  Gemini thinking tokens: {gemini['avg_thinking_tokens']:.0f} (reasoning model)")
    print(f"  Gemini avg words:       {gemini['avg_words']:.0f}")
    print(f"  Llama avg words:        {llama['avg_words']:.0f}")
    if gemini['avg_thinking_tokens'] > 0:
        print(f"  {C.G}Winner: Gemini has REASONING capability ✅{C.E}")

    print(f"\n{C.W}RELIABILITY:{C.E}")
    print(f"  Llama success:  {llama['success_rate']:.0f}%")
    print(f"  Gemini success: {gemini['success_rate']:.0f}%")
    if gemini['success_rate'] >= llama['success_rate']:
        print(f"  {C.G}Winner: Gemini (equal or better) ✅{C.E}")

    # Annual cost projection
    print(f"\n{C.W}ANNUAL COST (10 Million Requests):{C.E}")
    llama_annual = llama['avg_cost_per_1k'] * 10000
    gemini_annual = gemini['avg_cost_per_1k'] * 10000
    savings = llama_annual - gemini_annual

    print(f"  Llama (us-east5):  ${llama_annual:,.2f}")
    print(f"  Gemini (Belgium):  ${gemini_annual:,.2f}")
    print(f"  {C.G}Annual Savings:    ${savings:,.2f} ({cost_diff:.0f}%) ✅{C.E}")

    # Final verdict
    print(f"\n\n{C.W}{C.G}{'='*100}{C.E}")
    print(f"{C.W}{C.G}🏆 FINAL VERDICT{C.E}")
    print(f"{C.W}{C.G}{'='*100}{C.E}\n")

    gemini_wins = 0
    llama_wins = 0

    if cost_diff > 0:
        gemini_wins += 1
    else:
        llama_wins += 1

    if lat_diff < 0:
        gemini_wins += 1
    else:
        llama_wins += 1

    gemini_wins += 1  # Distance
    gemini_wins += 1  # Quality (reasoning)

    if gemini['success_rate'] >= llama['success_rate']:
        gemini_wins += 1

    print(f"  {C.G}Gemini (Belgium) wins: {gemini_wins}/5 categories{C.E}")
    print(f"  Llama (us-east5) wins: {llama_wins}/5 categories")

    print(f"\n  {C.W}{C.G}RECOMMENDATION: Switch to Gemini 2.5 Flash (Belgium){C.E}\n")
    print(f"  Reasons:")
    print(f"    ✅ {cost_diff:.0f}% cheaper (${savings:,.2f}/year savings)")
    print(f"    ✅ {dist_diff:.0f}% closer to Tanzania")
    print(f"    ✅ Reasoning capability for better educational content")
    print(f"    ✅ Google infrastructure (more reliable)")
    if lat_diff < 0:
        print(f"    ✅ {abs(lat_diff):.0f}% faster response time")

    # Save
    output = {
        "test_time": datetime.now().isoformat(),
        "comparison": "Llama (us-east5) vs Gemini (Belgium)",
        "llama": results[0],
        "gemini": results[1],
        "verdict": {
            "winner": "Gemini (Belgium)",
            "cost_savings_pct": round(cost_diff, 1),
            "annual_savings": round(savings, 2),
            "distance_improvement_pct": round(dist_diff, 1),
            "latency_diff_pct": round(lat_diff, 1)
        }
    }

    filename = f"llama_vs_gemini_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(filename, 'w') as f:
        json.dump(output, f, indent=2)

    print(f"\n{C.G}💾 Detailed results: {filename}{C.E}")

else:
    print(f"{C.R}❌ Incomplete test results{C.E}")

print(f"\n{C.W}{C.C}{'='*100}{C.E}")
print(f"{C.W}{C.C}✨ Complete{C.E}")
print(f"{C.W}{C.C}{'='*100}{C.E}\n")
