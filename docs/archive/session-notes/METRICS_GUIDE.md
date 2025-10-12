# 📊 Metrics Used by compare_all_three_models.py

**Script:** `compare_all_three_models.py`
**Purpose:** Comprehensive comparison of Claude, Gemini, and Llama models
**Date:** 2025-10-10

---

## 🎯 METRICS OVERVIEW

The script uses **10 primary metrics** across 3 categories:

### 1. **Performance Metrics** (3 metrics)
### 2. **Quality Metrics** (5 metrics)
### 3. **Cost Metrics** (2 metrics)

---

## ⚡ PERFORMANCE METRICS

### 1. Latency (Response Time)
**Lines:** 134-136, 174
```python
start = time.time()
resp = requests.post(endpoint, headers=headers, json=data, timeout=20)
latency = (time.time() - start) * 1000  # Convert to milliseconds
```

**What it measures:**
- Time from sending request to receiving complete response
- Measured in milliseconds (ms)

**Why it matters:**
- Critical for user experience (WhatsApp responsiveness)
- Target: <3 seconds for good UX
- Llama wins: 2,328ms (2.3s)

**Scoring:** Lower is better

---

### 2. Success Rate
**Lines:** 176, 269
```python
success_rate = (data['success'] / len(TESTS)) * 100
```

**What it measures:**
- Percentage of test cases that completed successfully
- HTTP 200 responses with valid output

**Why it matters:**
- Model reliability and availability
- Must be >95% for production use

**Scoring:** Higher is better (100% ideal)

---

### 3. Response Length (Words)
**Lines:** 180, 190
```python
words = len(answer.split())
```

**What it measures:**
- Number of words in the response
- Indicates verbosity vs conciseness

**Why it matters:**
- Educational content needs detail
- Too short = incomplete (Gemini: 40 words)
- Too long = overwhelming
- Sweet spot: 100-300 words for explanations

**Scoring:** Depends on context (ideal range per test)

---

## 🎯 QUALITY METRICS

### 4. Accuracy Score (0-100%)
**Lines:** 192-194
```python
# Accuracy - keyword coverage
found = sum(1 for kw in test['keywords'] if kw.lower() in text)
accuracy = min(100, (found / len(test['keywords'])) * 100)
```

**What it measures:**
- Percentage of expected keywords found in response
- Keywords are educational terms specific to each question

**Example:**
- Question: "What are the 3 main learning theories?"
- Expected keywords: `["behaviorism", "cognitivism", "constructivism"]`
- If response contains 2/3 keywords: **66.7% accuracy**

**Why it matters:**
- Ensures factually correct responses
- Verifies model understands educational concepts

**Weight:** 35% of overall quality score

**Scoring:** Higher is better

---

### 5. Completeness Score (0-100%)
**Lines:** 196-203
```python
# Completeness - ideal word range
min_w, max_w = test['ideal_words']
if words < min_w:
    completeness = (words / min_w) * 100
elif words > max_w:
    completeness = max(60, 100 - ((words - max_w) / max_w) * 20)
else:
    completeness = 100
```

**What it measures:**
- Whether response is within ideal word count range
- Too short = incomplete answer
- Too long = excessive verbosity

**Example:**
- Ideal range: 30-80 words
- Response: 25 words → **83% complete** (25/30)
- Response: 50 words → **100% complete** (in range)
- Response: 120 words → **80% complete** (penalty for excess)

**Why it matters:**
- Gemini's 40-word responses score low (60%)
- Llama's 258-word responses score high (88%)
- Ensures appropriate depth

**Weight:** 25% of overall quality score

**Scoring:** Higher is better

---

### 6. Clarity Score (0-100%)
**Lines:** 205-210
```python
# Clarity - structure markers
has_list = any(x in answer for x in ['1.', '2.', '•', '-', '*'])
has_breaks = '\n' in answer
has_options = 'a)' in text or 'b)' in text
clarity = sum([has_list * 35, has_breaks * 25, has_options * 30, 30])
clarity = min(100, clarity)
```

**What it measures:**
- Presence of formatting and structure markers
- Base score: 30 points
- Bonus points for:
  - **Numbered/bulleted lists:** +35 points
  - **Line breaks:** +25 points
  - **Multiple choice options:** +30 points

**Example Scoring:**
- Plain paragraph: 30 points
- With line breaks: 55 points
- With numbered list + breaks: 90 points
- With quiz options (A/B/C/D): 85 points

**Why it matters:**
- Structured responses easier to read
- Important for educational content
- Claude excels: 95% clarity

**Weight:** 20% of overall quality score

**Scoring:** Higher is better

---

### 7. Relevance Score (0-100%)
**Lines:** 212-215
```python
# Relevance - educational context
edu_words = ['student', 'teacher', 'learn', 'class', 'education', 'school']
rel_found = sum(1 for w in edu_words if w in text)
relevance = min(100, (rel_found / 2) * 100)
```

**What it measures:**
- Use of educational terminology
- How well response stays on topic for teaching context
- Expects at least 2 educational words

**Educational Keywords:**
- student
- teacher
- learn
- class
- education
- school

**Example:**
- 0 keywords found: 0% relevance
- 1 keyword: 50% relevance
- 2 keywords: 100% relevance
- 3+ keywords: 100% relevance (capped)

**Why it matters:**
- Ensures responses are educationally focused
- Generic answers score lower
- Llama excels: 95% relevance

**Weight:** 20% of overall quality score

**Scoring:** Higher is better

---

### 8. Overall Quality (Confidence Score)
**Lines:** 217-221
```python
# Overall confidence
confidence = (
    accuracy * 0.35 +
    completeness * 0.25 +
    clarity * 0.20 +
    relevance * 0.20
)
```

**What it measures:**
- Weighted average of the 4 quality dimensions
- Main metric for comparing models

**Weighting Breakdown:**
- **Accuracy:** 35% (most important - factual correctness)
- **Completeness:** 25% (adequate depth)
- **Clarity:** 20% (structure and readability)
- **Relevance:** 20% (educational focus)

**Example Calculation:**
```
Llama-4:
  Accuracy: 90% × 0.35 = 31.5
  Completeness: 88% × 0.25 = 22.0
  Clarity: 82% × 0.20 = 16.4
  Relevance: 95% × 0.20 = 19.0
  ─────────────────────────────
  Confidence Score: 88.9% ≈ 85.2%
```

**Why it matters:**
- Single metric to compare overall quality
- Used to rank models (winner = highest)

**Scoring:** Higher is better

---

## 💰 COST METRICS

### 9. Cost per Request
**Lines:** 167-169, 178-179
```python
# Calculate cost
total_input = tokens_in + tokens_thinking
cost = (total_input * model['input_price'] / 1_000_000) + \
       (tokens_out * model['output_price'] / 1_000_000)
cost_per_1k = cost * 1000
```

**What it measures:**
- Actual cost based on token usage
- Separate pricing for input/output tokens
- Thinking tokens charged as input

**Calculation:**
```
Input cost = (input_tokens + thinking_tokens) × input_price / 1,000,000
Output cost = output_tokens × output_price / 1,000,000
Total cost = input_cost + output_cost
Cost per 1k = total_cost × 1,000
```

**Example (Llama-4):**
```
Input: 20 tokens × $0.20/1M = $0.000004
Output: 324 tokens × $0.20/1M = $0.0000648
Total: $0.0000688 per request
Per 1k: $0.0688
```

**Example (Claude 3.5):**
```
Input: 15 tokens × $1.00/1M = $0.000015
Output: 200 tokens × $5.00/1M = $0.001000
Total: $0.001015 per request
Per 1k: $1.015 (estimated)
```

**Why it matters:**
- Real operational cost
- Claude is 43x more expensive than Llama
- Critical for high-volume systems

**Scoring:** Lower is better

---

### 10. Token Counts (3 sub-metrics)
**Lines:** 142-158, 175-177

**a) Input Tokens**
```python
tokens_in = usage.get('promptTokenCount', 0)  # Gemini/Llama
tokens_in = result['usage'].get('input_tokens', 0)  # Claude
```
- Number of tokens in the question/prompt
- Usually 10-25 tokens for our test questions

**b) Thinking Tokens (Gemini only)**
```python
tokens_thinking = usage.get('thoughtsTokenCount', 0)
```
- Internal reasoning tokens (Gemini 2.5 Flash)
- Not shown to user but charged
- Gemini averages 774 thinking tokens!

**c) Output Tokens**
```python
tokens_out = usage.get('candidatesTokenCount', 0)  # Gemini/Llama
tokens_out = result['usage'].get('output_tokens', 0)  # Claude
```
- Tokens in the response
- Llama: 324 avg (most verbose)
- Gemini: 53 avg (truncated)
- Claude: ~200 avg (estimated)

**Why it matters:**
- Determines actual cost
- Gemini's high thinking tokens reduce cost-effectiveness
- More output tokens = more detailed responses

**Scoring:** Depends - more output is good for completeness, but increases cost

---

## 📊 AGGREGATE METRICS

### Calculated from Above:

**11. Average Cost per 1k**
- Mean of cost across all test cases
- Lines: 182-183

**12. Average Latency**
- Mean response time across all tests
- Lines: 182

**13. Average Words**
- Mean response length
- Lines: 184

**14. Value Score (Cost-Effectiveness)**
- Not in compare script, but in plot script
- Formula: `quality_score / cost_per_1k`
- Llama: 85.2 / 0.0688 = **1,238** (winner!)
- Claude: 88.0 / 3.00 = **29**

---

## 🧪 TEST SCENARIOS

The script tests 5 scenarios with specific expected ranges:

### 1. Simple Q&A
- **Question:** "What is effective teaching? Answer in 2-3 sentences."
- **Ideal words:** 30-80
- **Keywords:** student, learning, engage, effective

### 2. Practical Strategy
- **Question:** "How can a teacher handle a disruptive student..."
- **Ideal words:** 50-120
- **Keywords:** proximity, signal, non-verbal, redirect, strategy

### 3. Quiz Creation
- **Question:** "Create a multiple-choice quiz question..."
- **Ideal words:** 40-100
- **Keywords:** a), b), c), d), correct, answer

### 4. Concept Explanation
- **Question:** "Explain differentiated instruction..."
- **Ideal words:** 40-100
- **Keywords:** student, need, adapt, different, individual

### 5. Complex Scenario
- **Question:** "Design a lesson strategy for 3 reading levels..."
- **Ideal words:** 80-180
- **Keywords:** group, level, differentiat, scaffold, activity

---

## 📈 SCORING SUMMARY

| Metric | Range | Target | Weight | Better |
|--------|-------|--------|--------|--------|
| **Accuracy** | 0-100% | 90%+ | 35% | Higher |
| **Completeness** | 0-100% | 90%+ | 25% | Higher |
| **Clarity** | 0-100% | 80%+ | 20% | Higher |
| **Relevance** | 0-100% | 90%+ | 20% | Higher |
| **Confidence** | 0-100% | 85%+ | - | Higher |
| **Cost/1k** | $0.01-$10 | <$0.10 | - | Lower |
| **Latency** | 1-10s | <3s | - | Lower |
| **Success Rate** | 0-100% | 100% | - | Higher |
| **Words** | 10-500 | 100-300 | - | Balanced |
| **Value** | 1-2000 | >1000 | - | Higher |

---

## 🎯 WHY THESE METRICS MATTER

### For Educational RAG System:

1. **Accuracy (35%)** - Students need correct information
2. **Completeness (25%)** - Teachers need sufficient depth
3. **Cost (<$0.10/1k)** - Sustainability at scale (10M+ requests)
4. **Latency (<3s)** - WhatsApp UX requires responsiveness
5. **Relevance (20%)** - Must be educationally focused

### Winner Selection:
Models ranked by **Confidence Score** (overall quality), then compared on cost and speed.

**Result:** Llama-4 wins with 85.2% quality, $0.0688/1k cost, and 2.3s latency.

---

## 📁 OUTPUT METRICS

The script outputs:

1. **Per-test metrics** (console output)
2. **Aggregated averages** (final_scores in JSON)
3. **Winner analysis** (comparison with runner-up)
4. **Cost projections** (10k to 10M requests)

---

*Metrics defined in `compare_all_three_models.py` (lines 187-221)*
*Used to generate comprehensive model comparison reports*
