# I'm building a tool that shows companies what AI says about them — and it's usually wrong

Hey IH! I'm Heejae, a solo founder based in Seoul, South Korea. I'm building **AAO (AI Answer Optimization)** — a diagnostic tool that checks how accurately ChatGPT, Gemini, and Perplexity describe your company.

## The problem I discovered

I asked ChatGPT about a company I was working with. The answer included wrong revenue numbers, an outdated address, and cited a job board instead of the official website.

The company owner said "it looks fine when I search." Turns out, **his ChatGPT had conversation history**. When you ask the same question in a fresh session with zero context, the answer is completely different.

That's when I realized: most companies have no idea what AI is telling people about them.

## Why this happens

Most company websites are built for humans — nice design, animations, marketing copy. But AI crawlers see the raw HTML. And for many sites (especially React SPAs), the raw HTML is literally:

```html
<div id="root"></div>
```

So AI engines pull from whatever third-party source has cleaner data — job boards, review sites, old news articles. Often with wrong or outdated info.

## What I built

AAO does three things:

1. **Structural lint** — checks if your site is AI-readable (static HTML, JSON-LD, sitemap, robots.txt)
2. **AI delivery check** — actually asks ChatGPT, Gemini, and Perplexity about your company and compares the answers to your declared facts
3. **AI Profile Page** — a dedicated `/ai-profile` page with all your official facts structured for AI consumption

The free diagnostic tool is live at [aao.co.kr/diagnose](https://aao.co.kr/diagnose).

## Where I am now

- Solo founder, bootstrapped
- Product is live in beta
- Tested against 100+ company websites
- Applied for a Korean government startup grant (results pending)
- Just published my first technical article on [Medium](https://medium.com/@bhj31029943/why-ai-search-engines-miss-official-company-facts-and-what-you-can-do-about-it-0ebf3b3f6660)

## Key insight so far

The companies that need this most are the hardest to convince. Their typical response: "Why do I need to change anything? My site looks fine."

That's because they test with their own search history. Their customers search from zero context — and get a completely different (often wrong) answer.

## What's next

- Onboarding first paying customers
- Adding external signal monitoring (checking what third-party sources say about you vs. your official facts)
- Product Hunt launch

Would love feedback from anyone who's worked on SEO/AEO or AI-related tools. Have you checked what AI says about your own company?

---

Built by [Heejae Byun](https://heejaebyun-portfolio.vercel.app) · [AAO](https://aao.co.kr) · [LinkedIn](https://www.linkedin.com/in/heejae-byun-2887671b3/)
