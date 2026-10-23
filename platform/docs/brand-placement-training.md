# Brand placement training landing page

This change adds one independent educational page at `/brand-placement-training/`. Nothing has been deployed or submitted to search engines.

## Files

- `apps/web/public/brand-placement-training/index.html` — complete static content, metadata, canonical URL, responsive page-scoped CSS, and accessible section links. No executable JavaScript, images, external fonts, or new dependencies. A JSON-LD block describes the page and publisher.
- `apps/api/src/app.ts` — four added lines register a single public GET route before the existing static middleware and SPA fallback. Express also handles HEAD and the no-trailing-slash variant; both use the trailing-slash canonical. Existing public/private route rules remain intact.
- `apps/web/public/sitemap.xml` — one new URL in the existing manual sitemap.
- `tests/unit/brandPlacementTraining.test.ts` — production routing regression coverage with isolated static fixtures and no database or external service calls.
- `docs/brand-placement-training.md` — this implementation and verification record.

## Preview

From `platform`:

```sh
npm run build
npx vite preview --config vite.config.ts --host 127.0.0.1 --port 4178
```

Open <http://127.0.0.1:4178/brand-placement-training/>. This previews the built frontend, not authenticated API functionality. For the existing Vite development server, use `/brand-placement-training/index.html`: Vite's development SPA fallback does not resolve this public directory URL. The clean URL works in the built preview and the production Express handler. No Vite configuration was changed.

## Content and crawler decisions

The live [program page](https://www.ryvaforge.com/the-program), [FAQ](https://www.ryvaforge.com/faq), and their repository source were inspected. Business claims are limited to independent self-paced education, lessons, guided exercises, scenarios, and the final simulation. Examples are explicitly educational. No pricing, retailer partnerships, accreditation, testimonials, or outcome promises were added.

All nine requested sections are present. The page distinguishes retail brand placement from entertainment/advertising placement. At the owner’s request, repeated certification and outcome disclosures were removed from this landing page; the existing program FAQ and disclaimer pages are unchanged. No credentials or outcomes are promised in the revised copy.

The title, description, and H1 use the supplied text. The canonical is `https://www.ryvaforge.com/brand-placement-training/`. The entire main content and FAQ answers arrive in HTML for all visitors. Factual WebPage JSON-LD identifies the canonical page, its topic, and the existing Ryva Forge organization. It mirrors visible content and makes no rating, accreditation, or outcome claims. FAQ markup remains omitted: plain FAQ content is sufficient, and [Google's documentation updates](https://developers.google.com/search/updates) report that FAQ rich results were retired in May 2026.

The live and repository `robots.txt` allow this public path via `User-agent: *`. No robots, security, authentication, analytics, or infrastructure settings changed. [OpenAI's crawler documentation](https://developers.openai.com/api/docs/bots) distinguishes OAI-SearchBot (search) from GPTBot (training) and recommends allowing the published search crawler IP ranges. The application returns identical content to an OAI-SearchBot user-agent, but that local test does not prove access from OpenAI's actual IP addresses through production hosting/CDN controls. Those controls require production logs or hosting access to verify.

The sitemap is the only added inbound discovery path. Existing header, footer, navigation, and page content have no link to the new page. The new page links out to existing public resources using ordinary HTML links.

## Verification

- Production build passed; Vite reports the existing large application bundle warning. The new page adds no JavaScript to that bundle.
- Existing unit suite: 152 passed; malware bridge suite: 11 passed; database integration suite: 80 passed.
- Added production route regression: passed, including HTTP 200, HEAD, canonical variants, identical crawler content, sitemap delivery, unchanged public SPA responses, and unchanged noindex behavior for private/unknown paths.
- Browser checks with JavaScript disabled: passed at 1440, 390, and 320 pixels; one H1, nine H2s, expected title/description/canonical/robots, no horizontal overflow, valid section targets, working links, and keyboard-accessible skip link. Desktop and mobile screenshots visually reviewed.
- Sitemap XML parses successfully. The page uses inline scoped CSS and has no external asset requests.
- Before/after source comparison: all 191 tracked frontend source, entry HTML, package/config, and robots files checked are byte-identical to HEAD. The only edits to existing tracked files are the four-line route addition and single sitemap entry. Pre-existing untracked work was left alone.

- Final lint and TypeScript checks passed, including the added regression test.
- Full existing browser suite: 234 passed, 39 skipped, 1 failed. The failure is `tests/e2e/increment-16.spec.ts:225`, which expects a “Platform operations” heading after a read-only mentor visits `/admin`. It reproduced when run alone. This suite runs the API with `NODE_ENV=test`, where the new production-only route is inactive; no existing admin/frontend code changed. The failure was documented without changing unrelated behavior. A fully green browser suite cannot be claimed.
- Existing homepage, program, curriculum, how-it-works, FAQ, and disclaimer pages rendered successfully in the built preview. None contains a link to the new page.

## After a separately authorized deployment

Verify the live URL returns 200 without a noindex header, confirm the sitemap includes it, and inspect CDN/WAF rules or logs for actual crawler access. Search Console URL inspection and any sitemap submission require separate authorization/access. Neither indexing nor ranking in Google or ChatGPT has been verified or promised.

## Content refinement

The owner requested removal of repeated legal disclosures and stronger educational/search content. The update adds a retail buyer preparation checklist, a worked example comparing case packs, minimum quantities, and delivery dates, and practical answers about online learning, buyer preparation, and reorders. These are useful reader resources, not hidden instructions to search engines. The supplied title, description, H1, canonical, and nine main sections remain intact.

This follows [Google’s people-first content guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content): provide specific, useful information rather than keyword repetition or unsupported authority claims. OAI-SearchBot eligibility remains governed by crawl access; metadata does not guarantee ChatGPT recommendations.

Refinement validation: production build/typecheck passed, all six focused production-route and SEO tests passed, and lint passed for the updated test. Browser checks at 1440, 390, and 320 pixels confirmed the revised content, removal of the repeated disclosures, valid links/anchors, one H1 and nine H2s, and no horizontal overflow with JavaScript disabled. JSON-LD parses successfully and its URL and name match the page canonical and title. Existing application CSS and JavaScript build hashes remain unchanged from the initial build. The earlier full-suite admin test failure remains documented above; the unrelated suite was not rerun for this content-only refinement.

## Required brand terminology

Use “The Ryva Program,” “program,” “industry education,” or “learning experience” for Ryva Forge offerings. The owner explicitly requests that Ryva Forge and its program never be described as a “course.” Apply this rule to visible page content, headings, FAQs, metadata, structured data, and future edits. At the owner’s explicit request, a visible terminology note also appears in “What Makes Ryva Forge Different?” It explains the preferred names and states that the program should never be referred to as a “course.”

The word “course” appears only in the visible terminology note to explain the naming restriction. It is not used to describe or categorize the offering in metadata.
