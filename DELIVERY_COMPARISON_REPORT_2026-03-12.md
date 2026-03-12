# AAO Delivery Comparison Report

Date: 2026-03-12

This note summarizes two delivery-check cohorts run with the AAO v5 pipeline.

## Cohorts

### SEO comparison cohort
Source file: `scripts/urls-seo-comparison-live.txt`

URLs:
- `https://www.semrush.com`
- `https://ahrefs.com`
- `https://www.conductor.com`
- `https://www.botify.com`
- `https://www.hubspot.com`
- `https://www.shopify.com`

### AI/GEO and customer cohort
Source file: `scripts/urls-ai-vendors-and-customers-live.txt`

URLs:
- `https://www.upstage.ai`
- `https://www.alcherainc.com`
- `https://www.deepbrain.io`
- `https://www.selectstar.ai`
- `https://www.hsad.co.kr/`
- `https://www.opentable.com`
- `https://www.toyotaconnected.com`
- `https://www.lyft.com`
- `https://www.samsung.com`
- `https://www.maersk.com`
- `https://www.paypal.com`
- `https://www.bestegg.com`
- `https://www.docebo.com`
- `https://www.stanleyblackanddecker.com`
- `https://www.libertylondon.com`
- `https://group.mercedes-benz.com`
- `https://www.bazaarvoice.com`

## Delivery results

### SEO comparison cohort

Engine delivery rate:

| Engine | Delivered / Total | Rate |
|---|---:|---:|
| ChatGPT | 7 / 12 | 58.3% |
| Gemini | 4 / 12 | 33.3% |
| Perplexity | 3 / 12 | 25.0% |

Review summary:
- `WARN`: 0
- `REVIEW`: 1
- `INFO`: 22

Observed pattern:
- `jsonld_only_miss` was common for `Semrush`, `Ahrefs`, `Conductor`, and `Shopify`.
- `Botify`, `HubSpot`, and `Shopify` showed stronger delivery than the rest of the SEO cohort.

### AI/GEO and customer cohort

Preflight summary:

| Status | Count |
|---|---:|
| `gt_positive` | 17 |
| `gt_absent` | 24 |
| `crawl_error` | 12 |

Engine delivery rate:

| Engine | Delivered / Total | Rate |
|---|---:|---:|
| ChatGPT | 13 / 26 | 50.0% |
| Gemini | 13 / 28 | 46.4% |
| Perplexity | 7 / 27 | 25.9% |

Review summary:
- `WARN`: 3
- `REVIEW`: 2
- `INFO`: 53

Observed pattern:
- `jsonld_only_miss` dominated again.
- `Upstage` was one of the strongest pages in the cohort.
- Several AI-related or enterprise pages still exposed weak delivery despite having declared facts.

## Main findings

### 1. SEO strength does not guarantee AI delivery strength

The SEO cohort contains globally strong SEO platforms, but many still show weak field delivery when official facts are declared only in structured data.

Practical reading:
- SEO optimization and AI fact delivery are related, but not the same problem.

### 2. JSON-LD alone is not enough

Across both cohorts, the most repeated pattern was `jsonld_only_miss`.

Practical reading:
- Declaring facts in `Organization` JSON-LD helps.
- But AI engines often fail to carry those facts into answer text unless the same facts are also visible in plain text.

Recommended AAO rule:
- Keep JSON-LD.
- Add a human-readable facts block.
- Add a clear first-sentence entity definition.

### 3. Engine behavior differs meaningfully

Observed tendency:
- `ChatGPT` was generally the most stable.
- `Gemini` often delivered fields without strong citation evidence.
- `Perplexity` was the most conservative and had the lowest delivery rate in both cohorts.

Practical reading:
- A page that "works" in one engine does not automatically work in all three.
- AAO should continue to validate all three engines independently.

### 4. Many sites still are not even delivery-test ready

In the broader AI/GEO/customer candidate set, only `17 / 53` URLs were `gt_positive`.

Practical reading:
- Many sites still do not expose enough declared facts for delivery validation at all.
- This supports AAO's product direction: facts declaration structure itself is part of the problem.

## Product message draft

Recommended message from these experiments:

1. SEO-friendly is not automatically AI-friendly.
2. Organization JSON-LD alone is not enough for reliable AI delivery.
3. Plain-text facts blocks and explicit entity definitions still matter.
4. AI delivery must be checked engine by engine.

## Next actions

1. Expand the `gt_positive` delivery cohort from `17` to `25+` URLs.
2. Keep `urls-blockage.txt` separate from delivery tuning.
3. Freeze the current review policy in fixtures:
   - `jsonld_only_miss -> info`
   - `total_miss + all jsonld_only -> info`
   - `subpage content_summary -> uncertain`
4. Turn these findings into the public diagnostic narrative:
   - problem
   - cause
   - fix
   - proof by cohort comparison
