# FAI — "The State of Industrial Robotics" (index & extract)

- **Authors:** Amelia Michael & Emerson Alden (Foundation for American Innovation, Physical Intelligence project)
- **Published:** 2026-06-17 · 28pp · captured 2026-06-18
- **PDF:** `fai-state-of-industrial-robotics-2026-06-17.pdf` (orig: cdn.sanity.io/files/d8lrla4f/staging/c308cec3d1f94f55616604d82396cd06af4da35e.pdf)
- **Landing:** https://www.thefai.org/posts/the-state-of-industrial-robotics
- **Companion dataset (public Google Sheet):** https://docs.google.com/spreadsheets/d/1_W5GhalChUjbZp_KyaGEZPKBLmRpA4bTsggBmDEaegw/edit (tabs referenced: Tab 1 companies, Tab 3 margins, Tab 9 cobot share, Tab 10 machine-shop density, Tab 11 subsidies, Tab 16 reducer procurement)

## Thesis
Traditional industrial robots use little AI and get left out of frontier-robotics policy debates — but they're about to become AI-integrated, and leadership in their manufacture/adoption becomes national power. China is a *secondary* player in traditional arms today but is more competitive in cheaper, software-intensive categories (cobots), which proxy the AI-integrated future. US is **not** competitive in industrial-robot manufacturing; Japan + Europe are. A non-Chinese supply chain is still viable but only if allies keep pace into AI integration.

## Hard numbers worth landing in the data
**Market structure**
- Global industrial-robot market ≈ **$15B** (FAI bottom-up); IFR reports **$16.7B** (2024).
- Japan + Europe HQ firms ≈ **85%** of revenue; **Japan alone ≈ 50%**.
- Top 4 — **ABB** (Switzerland, being acquired by a Japanese firm), **FANUC** (Japan), **Yaskawa** (Japan), **KUKA** (Germany, owned by China's Midea) — ≈ **half** of total revenue; all founded 1960s–70s.
- High payload: Japan+Europe = **8 of 10** firms making any >600 kg robot; FANUC M-2000iA/2300 = **2,300 kg**, world's highest.
- China reliance by sector: imports **69%** of installed automotive robots, **0%** of textile robots (all domestic).
- No Chinese firm > **2%** of global industrial-arm market. Median Chinese-firm profit margin **<1%** vs **>4%** industry-wide. Siasun, Efort, Dobot unprofitable despite subsidies.
- China **surpassed Japan in production share in 2024**. Operational stock 2024: **2M robots, >4× Japan** (next largest).
- Company formation: Japan — no significant new industrial-robot firm since **1985** (RORZE); avg Japanese robotics-division firm ≈ 90 yrs old. China — ≥**22** operating industrial-robot firms started in 5 decades (14 in last 2); est. **3,400+** robotics startups overall.

**Cobots (leading indicator of AI-integrated arms)**
- ≈ **12%** of industrial-robot installations (2024).
- **Universal Robots** (Denmark) ≈ **30%** share; most of the rest of the top list is Chinese. FANUC+KUKA+ABB+Yaskawa combined cobot share only **~10–20%** (vs ~50% of overall arm market).
- China = **>50%** of global cobot shipments since 2023. Domestic suppliers meet **~90%** of China's cobot demand vs **~60%** of overall industrial-robot demand.
- UR opened first overseas plant (China) late 2024; revenue declining.

**Components**
- Precision reducers: **strain-wave (harmonic)** — used in cobots/humanoids; **RV** — heavy/high-precision arms.
- **Nabtesco** ≈ **50%** of global precision reducers for medium-large robots (ex-China); total capacity 1.15M/yr, 980k ex-China. **Harmonic Drive Systems (HDS)** = largest strain-wave maker, revenue ≈ **5× Leaderdrive** (largest Chinese competitor).
- Spare capacity: Nabtesco **70%** utilization on largest plant; HDS **50%** — both could surge without new plants (HDS could ~triple on 3-shift basis).
- US reducer production: **HDS Beverly, MA** (~10–20% of HDS output); **Cone Drive** (Timken) Michigan; **Regal Rexnord** positioned to enter; Schaeffler (DE) capable but not committed. China has **≥6** domestic harmonic-drive makers at scale.
- Leaderdrive share of UR's reducers went **13% → 31%** (2018→2019).
- Strain-wave can be substituted with **planetary gearboxes** if supply fails → unlikely China chokehold.
- Servo motors: commoditized, many suppliers; Chinese cheaper. Real risk = **rare earths** (dysprosium for neodymium magnets at 155°C windings). Dysprosium oxide in US already **>4×** China price.

**China state support**
- Avg municipal demand-side subsidy rate **17.5%** (≈ $8,000 on a $40,000 robot); >80% of subsidies exceed 10% of price. Guangzhou: up to 20% of unit cost.
- 2016: subsidies = **4–49%** of net profit of top-4 listed firms. 2024: lifted profit margins of 8 listed firms by **0.4–11.9 pts**.
- Mar 2025 state-backed VC fund expected to attract **$138B** (1T yuan) over 20 yrs.
- Informal support (below-market credit + discounted land) ≈ **25%+** of manufacturing support.

**Ecosystem / clusters**
- Machine-shop density: Jiangsu **>100 / 1,000 km²** vs top US state Connecticut **~25**. Guangdong+Jiangsu+Zhejiang = **>80%** of Chinese CNC shops (top-3 US states <30%).
- Chinese CNC shops: **>40%** of demand is 1–5-unit prototype orders; avg first quote **<1 hour**.
- Integration services ≈ **two-thirds** of robotics deployment cost (local service/customization matters → production aids deployment).
- China ecosystem hard for foreigners to fully tap: Chinese-IP-only marketplaces, WeChat-based sourcing, language barriers, 1–2 wk shipping, security concerns.

## Biggest gap vs our site
companies.json tracks 11 "industrial" firms but **none** of the incumbents that actually hold the market — FANUC, ABB, KUKA, Yaskawa, Universal Robots, Nabtesco, HDS. We over-index on frontier/humanoid. The report is the canonical source to fix that and to harden the supply-chain reducer/servo/rare-earth records.
