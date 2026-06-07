# MAGSNAP Alignment Map

Updated: 2026-06-07

This file records which local MAGSNAP knowledge sources have been used to align the website direction. It exists because another chat thread cannot be read directly from the model context, but the local project and knowledge-base files can be read and treated as the executable record.

## Priority Order

1. The user's latest direct instruction in the current working thread.
2. `MAGSNAP_SOURCE_OF_TRUTH.md`.
3. Active local MAGSNAP knowledge-base files listed below.
4. Historical briefs and old prototypes, only when they do not conflict with the higher-priority sources.

## Active Sources Read

### `wechat_knowledge_base/deep_analysis/magsnap_core_vision_wme.md`

Use as the long-term product vision.

Key points:

- MAGSNAP is a Wearable Magnetic Ecosystem.
- The glasses are the first base platform.
- The deeper innovation is a standardized magnetic mounting interface on the human head.
- The base glasses should contain no battery, processor, built-in camera, microphone, speaker, or display.
- Intelligence and function live in removable modules.
- Current or relevant modules include camera, audio, walkie talkie, tracking, light, and future AI pods.
- AI Pod has concept validation, but current third-party AI pod products are not mature enough.

### `wechat_knowledge_base/deep_analysis/magsnap_market_entry_decision.md`

Use as business strategy background, not direct homepage CTA copy.

Key points:

- Long-term positioning remains Wearable Magnetic Ecosystem.
- First market expression should stay sharp around lightweight action camera / POV users.
- China and Vietnam are launch bases; overseas brand and pricing remain important.
- First target users: kitesurf users, FPV users, mobile creators, and lightweight action-camera users.
- Insta360 is first strategic target; DJI is second strategic target.
- The current homepage should not jump straight into broad claims or large strategic partnerships.

Conflict note:

- This source contains Founding 900 and pricing strategy. The user's later website instruction says the current homepage is not for signup, crowdfunding, or direct purchase. Therefore those sales/kit terms are business background only and are not active homepage copy.

### `wechat_knowledge_base/deep_analysis/magsnap_paid_product_strategy.md`

Use for validation discipline.

Key points:

- Current route should be paid closed testing, single-scene productization, founder-led direct validation, then scale only after evidence.
- First scenario: mobile creators who already use small cameras for POV content.
- Do not enter too many markets at once.
- Do not use free giveaway logic to fake demand.
- Core product thresholds: attachment reliability, weight/stability, comfort, compatibility clarity, and fast use.
- Feedback priority: safety and detachment risks first; then quality, comfort, compatibility, misunderstanding, sustained-use issues, and cosmetic suggestions.

Homepage implication:

- The page must be product-understanding-first and should avoid inflated claims.

### `wechat_knowledge_base/deep_analysis/magsnap_visual_safety_response_plan.md`

Use for warning, FAQ, and Opti-Grab handling.

Key points:

- The Opti-Grab / cross-eyed concern should be answered directly.
- Do not claim MAGSNAP can never cause visual problems.
- Safer statement: MAGSNAP does not place a prism, display, or lens in front of the eyes; users do not look at the camera; the module sits outside normal line of sight.
- Stop use if double vision, eye strain, headache, dizziness, nausea, blocked vision, or visual discomfort occurs.
- Use only tested lightweight configurations.
- Children are not the first target user group.
- Users with strabismus, amblyopia, binocular vision issues, or double-vision history should consult an eye-care professional before use.

### `wechat_knowledge_base/deep_analysis/magsnap_video_content_system.md`

Use for content logic and page proof direction.

Key points:

- MAGSNAP needs real video evidence more than polished ads.
- Important content pillars: one-second understanding test, first-time setup, founder daily carry, objection lab, field tests, partner proof, and module lab.
- Product must appear in the first seconds.
- Keep confusion, questions, and failure moments when useful.
- Module Lab should show platform potential without pretending all modules are mature.

Homepage implication:

- The homepage should support future real videos/GIFs and not rely only on static concept copy.

### `wechat_knowledge_base/deep_analysis/magsnap_light_module_bundle_strategy.md`

Use for ecosystem explanation and light-module caution.

Key points:

- A light module helps users understand MAGSNAP as an ecosystem rather than only camera glasses.
- It should be called MAGSNAP Light Module, not a free headlight or gift lamp.
- Battery modules add safety, shipping, heat, charging, and support complexity.
- The base glasses remain 100% magnetic and 0% electric; removable modules can contain electronics if separately tested.

Homepage implication:

- Light can appear as a module category, but current homepage should not promise a bundled light unless that business decision is active again.

### `wechat_knowledge_base/deep_analysis/magsnap_90_day_channel_acceleration_plan.md`

Use for channel discipline.

Key points:

- Founder daily use is a strong brand asset.
- Current need is not large traditional agents, but traceable partner/creator/club validation.
- Brand should control product definition, price, page, messaging standards, payment, fulfillment, support, and customer data.
- Partners should show real use and earn from real orders, not recruit sub-agents.

Homepage implication:

- Current homepage can support understanding and credibility, but should not become a broad agent recruitment page.

### `magsnap_founder_history.md`

Use as founder/background context, with evidence boundaries.

Key points:

- MAGSNAP has real design, supply-chain, magnet, patent, trademark, LLC, media, packaging, and inventory history.
- Kickstarter/BackerKit route was later stopped and should not be treated as the current route.
- The hard-won hardware story is real, but current public copy must avoid overclaiming patents, safety, compliance, or commercial traction.

## Current Website Rule

The current homepage is an understanding page, not a sales page.

It should communicate:

- MAGSNAP V2.
- The Wearable Magnetic Ecosystem.
- The glasses are the base; the magnetic interface is the product.
- Snap / Use / Remove.
- Real use, module categories, frame design, lab/feedback, origin, contact.
- Safety and disclaimer warnings.

It should not communicate:

- Kickstarter.
- Founding 900.
- Buy Now / Shop Now.
- Direct sales funnel.
- Mass-market promises.
- "Built by DJI pilot."
- Guarantees such as 100% safe, never falls off, or never blocks vision.

## Operating Rule For Future Changes

Before changing the homepage, first check:

```bash
rg -n "MAGSNAP|Wearable Magnetic|Kickstarter|Founding 900|Built by DJI|Optical Grab|safety|warning" MAGSNAP_SOURCE_OF_TRUTH.md MAGSNAP_ALIGNMENT_MAP.md index.html
```

After changing the homepage, verify:

```bash
rg -n "Kickstarter|Founding 900|Buy Now|Shop Now|Built by DJI pilot|Built as my daily toy|Former DJI Europe Sales" index.html mobile_story.html desktop.html README.md
rg -n "MAGSNAP V2|The Wearable Magnetic Ecosystem|Snap\\. Use\\. Remove|MZ worked in DJI Europe|not protective eyewear|No prism|eye strain" index.html
```
