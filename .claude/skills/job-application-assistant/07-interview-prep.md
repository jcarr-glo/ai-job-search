---
framework_version: 1.0.0
---

# Interview Preparation Guide

<!-- SETUP: STAR examples are personalized by running /setup based on your actual experience -->

## STAR Format

Structure answers as: **Situation** (context), **Task** (your responsibility), **Action** (what you did), **Result** (outcome).

Keep answers to 1-2 minutes. Be specific. End with what you learned or would do differently.

## Ready-Made STAR Examples

<!-- These are populated by /setup from your actual experience. Below are templates showing the format. -->

### 1. Scaling Blue Ocean's overnight trading platform 10x (executive leadership, scale execution)
**S:** Blue Ocean Technologies operated the first SEC-registered Alternative Trading System for overnight U.S. equities trading, a new and unproven market segment starting at roughly $100M in nightly notional value.
**T:** As Head of Technology and Acting CTO, reporting directly to the CEO, responsible for the infrastructure and organization needed to grow that volume without compromising the FINRA/SEC-regulated platform's reliability.
**A:** Led a 9-person technology organization; directed the matching engine migration to MEMX and clearing migration from Velox to RQD; implemented a fully redundant disaster recovery site; built out high-availability infrastructure (hot-hot architecture, Datadog observability) to support growing broker-dealer and institutional participant volume across North America, Europe, and Asia.
**R:** Nightly notional volume scaled 10x, from approximately $100M to over $1B, while maintaining regulatory compliance and platform stability.
**Use for:** "Tell me about a time you scaled a system/organization", "Describe your experience in a regulated environment", "Tell me about leading through growth"

### 2. Founding John Deere's first enterprise data mart (technical vision, securing buy-in)
**S:** John Deere's customer and product data was fragmented across business divisions, with no centralized platform to support autonomous vehicle initiatives or enterprise-wide KPIs.
**T:** As Lead Tableau Developer for the Intelligent Solutions Group, needed to make the case for and deliver the company's first enterprise data mart.
**A:** Wrote the project charter, secured $1.2M in funding, and architected the data integration (MySQL, Informatica ETL, Google Analytics, Adobe Analytics) consolidating call center, sales, demographic, and equipment telemetry data across 8 sources and 5M+ records.
**R:** Delivered a centralized reporting and analytics platform that supported autonomous vehicle initiatives and enterprise decision-making, and produced 35+ downstream reports reaching 27,000+ views.
**Use for:** "Tell me about a project you had to pitch/fund", "Describe building something from zero", "Tell me about a time you influenced without direct authority"

### 3. Establishing AI governance at a regulated trading venue (responsible AI adoption)
**S:** Blue Ocean wanted to adopt ChatGPT and Claude Code across its engineering organization, but the company operated a FINRA/SEC-regulated trading venue where ungoverned tool adoption carried compliance risk.
**T:** As the primary technology representative for regulatory engagements, needed to enable AI adoption without creating compliance exposure.
**A:** Established enterprise AI governance policies and usage standards covering LLM integration, data handling, and appropriate use cases; led adoption of the tools across the engineering organization within those guardrails.
**R:** Enabled organization-wide AI tool adoption (including Claude Code for engineering work) while supporting, rather than jeopardizing, regulatory compliance.
**Use for:** "How have you approached AI adoption on your team?", "Tell me about balancing innovation with compliance/risk", "Describe your AI governance philosophy"

### 4. Building the first analytics team at Investor Management Services (team building, P&L ownership)
**S:** IMS had no dedicated analytics function; reporting and portfolio review for a commercial real estate SaaS product were manual.
**T:** As Head of Data & Analytics / Director of Analytics, needed to build a team and a product from scratch, and own the department's P&L.
**A:** Grew the analytics function from a single person to a 5-member team (8 across analytics and data combined); led development of a CRM and automated waterfall distribution/portfolio analytics platform from concept to market; automated previously manual investment reporting.
**R:** Took the analytics function from zero to a shipped SaaS product line with a dedicated, retained team - while owning the department's financial performance.
**Use for:** "Tell me about building a team from scratch", "Describe a time you owned a budget/P&L", "Tell me about taking a product from concept to market"

### 5. Cross-asset data strategy at Wells Fargo (stakeholder alignment, technical liaison)
**S:** Wells Fargo's Fixed Income Electronic Trading desks needed a firm-wide, real-time data strategy, but requirements had to be gathered directly from trading floors across multiple asset classes with competing priorities.
**T:** As Fixed Income Data Architect / Data Scientist, served as the primary liaison between trading desks and technology teams.
**A:** Implemented OneTick time-series infrastructure as a centralized data repository capturing reference data, quotes, trades, and orders across Treasury, Municipal, and Equity trading; designed shared data schemas and enterprise data dictionaries so different desks could work from consistent definitions.
**R:** Delivered a firm-wide, cross-asset real-time data platform and reporting capability adopted across multiple trading desks.
**Use for:** "Tell me about aligning stakeholders with competing priorities", "Describe translating business requirements into technical architecture", "Tell me about working in a highly regulated industry"

### 6. Load/latency testing a live matching engine before production releases (technical rigor, pre-production validation)
**S:** Blue Ocean's matching-engine and platform releases needed to withstand real overnight trading volume without knowing in advance how throughput and latency would hold up under load.
**T:** As the engineer responsible for release validation, needed a repeatable way to prove platform performance before code reached production.
**A:** Engineered Python tooling on the C++ QuickFIX engine for real-time data ingestion directly off the matching engine, then built a QuickFIX-based load-testing harness in Python that drove millions of order messages at the matching engine to measure throughput and latency ahead of each release.
**R:** Gave the team a concrete, repeatable performance gate before shipping to a live, regulated overnight trading venue, catching throughput/latency issues pre-release rather than in production.
**Use for:** "Tell me about how you validate a system before it goes live", "Describe a time you built your own testing tooling", "Tell me about ensuring reliability in a high-stakes environment"

<!-- Add more STAR examples as needed. Aim for 4-6 covering different competencies. -->

## Common Tough Questions

### "Why did you leave [previous company]?"
> [PREPARE YOUR ANSWER - be honest, forward-looking, no negativity about former employer]

### "You don't have [specific skill/experience]."
> [PREPARE YOUR ANSWER - acknowledge the gap, bridge to adjacent experience, show willingness to learn]

### "Where do you see yourself in 5 years?"
> [PREPARE YOUR ANSWER - show ambition aligned with the role's growth path]

### "What's your biggest weakness?"
> [PREPARE YOUR ANSWER - genuine weakness with concrete mitigation strategy]

### "Why this company specifically?"
> Customize per company. Must reference: specific projects, company values, market position, or team structure. Never give a generic answer.

## Questions You Should Ask Interviewers

### About the Role
- "What does a typical week look like in this role?"
- "What would success look like in the first 6 months?"
- "What's the biggest challenge the team is facing right now?"

### About the Team
- "How big is the team, and how do you divide work?"
- "What does the development/project lifecycle look like, from idea to production?"
- "How do you onboard new team members?"

### About Tech & Growth
- "What's your current tech stack for [relevant area]?"
- "Is there room to grow into more architectural or strategic decisions?"
- "How does the team stay current with new tools and methods?"

### About Culture (use these to prevent disappointment)
- "How would you describe the team culture?"
- "What does professional development look like here?"
- "Is there flexibility for remote/hybrid work?"
- "What's the balance between development/new projects and maintenance work?"
- "How would you describe the leadership style in this team?"
- "What do people who thrive here have in common?"

## Phone/Video Interview Tips
- Have STAR examples written out (use this file)
- Keep a glass of water nearby
- Smile when speaking (it changes your tone)
- Ask for clarification if a question is vague
- It's OK to take 5 seconds to think before answering
- End with: "Is there anything else you'd like to know about my background?"

## After the Application (Best Practice)

### Follow-Up Etiquette
- **Don't call to "stand out"** or to learn more about the role post-submission - this risks a negative impression
- If the employer specified a timeline, respect it and wait
- If no timeline was given and significant time has passed (2+ weeks), a brief call to ask about status is acceptable
- If you have genuinely new, relevant information to share, a short follow-up is fine

### Thank-You Notes
- When you receive any update (interview invitation, rejection, or status update), send a brief thank-you message
- Express appreciation for their time and the process
- Keep it short (2-3 sentences)

## Roleplay Guidelines
When the user asks for interview practice:
1. Ask which role/company to simulate
2. Start with easy warm-up questions ("Tell me about yourself")
3. Progress to role-specific technical questions
4. Include 1-2 behavioral questions using the competencies from the job posting
5. End with a tough question or curveball
6. After each answer, give brief feedback: what worked, what to sharpen
7. Suggest which STAR example would work best for each question
