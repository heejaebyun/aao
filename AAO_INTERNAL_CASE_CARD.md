# AAO Internal Case Card

Date: 2026-03-13

Entity: AAO (AI Answer Optimization)

Official AI Profile: https://aao.co.kr/ai-profile

## Snapshot

Same domain, same entity, different structure.

- Main landing (`/`) remains marketing-first.
- Official AI Profile (`/ai-profile`) is the structured source hub.
- ChatGPT is already maxed.
- Gemini improves when the structured hub is present.
- Perplexity remains the external citation / discovery bottleneck.

## Before vs After

| URL | Role | Lint | Ground Truth | ChatGPT | Gemini | Perplexity |
| --- | --- | --- | --- | --- | --- | --- |
| `https://aao.co.kr/` | Main landing | 3/5 | 7 fields, FAQ 0 | 7/7, `exact` | 2/7, `none` | 0/7, `none` |
| `https://aao.co.kr/ai-profile` | Official AI Profile hub | 4/6 | 7 fields, FAQ 5 | 7/7, `exact` | 4/7, `none` | 1/7, `path` |

## What Changed

- Static facts block moved into a dedicated official hub.
- JSON-LD and visible facts were aligned.
- FAQ pairs were added for quote-ready answers.
- Key pages and official-source policy were consolidated in one page.
- English fact layer was simplified for global AI engines.

## Readout

- Structure improvement is real: `lint 3/5 -> 4/6`.
- Gemini improvement is real: `2/7 -> 4/7`.
- ChatGPT stays at `7/7`, which means the entity layer is already machine-readable.
- Perplexity only moves from `0/7 -> 1/7`, which suggests the next bottleneck is not on-page structure but off-site citation and discovery signals.

## Internal Takeaway

AAO's official AI Profile hub improved machine readability on the same domain without changing the entity itself. The clearest gain is Gemini coverage, while Perplexity still needs external citation signals even after on-site structure is cleaned up.

## Copy-Ready Summary

AAO's main landing and official AI Profile were tested on the same domain. After consolidating official facts, aligned JSON-LD, and FAQ into `/ai-profile`, ChatGPT stayed at 100%, Gemini improved from 2/7 to 4/7, and Perplexity moved from 0/7 to 1/7. The remaining gap is now off-site citation and discovery, not basic on-page structure.
