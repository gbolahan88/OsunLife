# Osun Life — Build Tracker

Reference: Lagos Life (lagoslife.app, by Shalom Rayhamen / Eliy, launched 1 Oct 2026).
Stack: Next.js (App Router, TypeScript, no `src/`), Tailwind, Framer Motion, Zustand, Firebase.
Rule: we copy the *ideas*, never the name, art, text or brand. Osun Life is its own game.

Sources for the reference notes: your screenshots, plus public fan guides (lagoslife.net, lagoslifewiki.com, toptrending.games). I could not open the game itself (it is client-rendered and needs login), so numbers are snapshots from fan guides and may change.

---

## 1. What Lagos Life does (reference notes)

**Core loop:** sign up, customise a character, get a home, take a job, travel the map, spend naira, meet other real players.

**Setup flow (per fan guides):** username, appearance, traits and a dream, a one-time "birth lottery", then pick an available home. Players must be 18+.

**HUD (from screenshot):** in-game clock with sun icon, mood label, mute toggle, naira balance with "+" top-up button, "visits" and "online" counters.

**Needs (from screenshot icons, six bars):** food, energy, fun, social, hygiene, bladder. Low needs hurt mood.

**Map:** top-down tile map, emoji pins for places, filter chips (Moving, Ads, Homes, Sea, Gov, Walk), city tabs (Lagos, Port Harcourt, Abuja, Names). About 30 open locations plus Airport and Refinery "coming soon".

**Bottom nav:** Home, Buy, Map, Phone. The Phone holds Jobs, contacts and messages.

**Profile tabs:** Profile, Needs, Goals, Skills, People, Career. 3D avatar you can drag to spin.

**Economy (snapshot, early Oct 2026):**
- 21 careers, 5 ranks each, pay per shift roughly ₦6,600 to ₦99,000.
- Shift = about one real hour, one shift per in-game day, only inside the job's time window, must travel to the workplace first.
- Promotion needs full performance meter plus the next skill level. Some careers are gated behind skill 3.
- Commute about ₦150 per trip. Rent due every Saturday. Weekly earnings under ₦1,000,000 tax-free.
- Businesses, land plots and trailers as late-game spending.
- Real-money top-ups exist, in-game naira has no cash-out value.

**Civic layer:** weekly Governor election by players, laws (for example a transport subsidy), police and jail, courthouse.

**Money model for the studio:** player-rented billboards on the map and "Sea Plots". Top-ups.

**Day and night:** work shifts and nightlife are time-window based (clubs and shrine in the evening, office by day). This is why our clock must drive both visuals and gameplay.

---

## 2. Osun Life mapping (ideas to verify before we commit)

| Lagos Life idea | Osun Life version |
|---|---|
| Lagos / Port Harcourt / Abuja tabs | Osogbo / Ile-Ife / Ilesa / Ede / Iwo (town tabs) |
| Beach, Boat Cruise, Sea Plots | Osun River, Olumirin Waterfall (Erin-Ijesha), grove paths. Osun is landlocked, so no sea. |
| Canopy Walk | Osun-Osogbo Sacred Grove |
| Market | Oja Oba (Osogbo) |
| UNILAG | OAU (Ile-Ife), UNIOSUN (Osogbo) |
| Afrika Shrine, Quilox | Local live-music spot, owambe venue (our own names) |
| Amala Shitta | Amala joint in Ede, ikokore in Ilesa |
| Freedom Park, museum | Ife Museum, Ooni's palace area, Oranmiyan Staff |
| Danfo | Okada and keke |
| Governor election | Ataoja or town-chief style council (design later) |

Place names above are candidates. We will confirm each one before it goes in the game.

---

## 3. Day and night design (your requirement)

- One game clock drives everything. Proposed: 1 real minute = 1 game hour (tunable in one constant).
- Phases from the hour: dawn 5-7, day 7-17, dusk 17-19, night 19-5.
- Visuals: sky tint overlay on the map and HUD icon switches sun / moon. Pins glow at night.
- Gameplay: shop and job opening hours, nightlife only open at night, energy drains faster when awake at night, safety/mood events differ by phase.
- Implementation home: `lib/time.ts` (`getDayPhase(hour)`), used by the store and a `DayNightOverlay` component.

---

## 4. Roadmap

- [x] **Step 1** — Project setup and app shell (HUD, bottom nav, 4 tabs)
- [ ] **Step 2** — Game engine: clock with day/night phases, needs draining, money, mood, Zustand store, local save
- [ ] **Step 3** — Map: pannable and zoomable, Osun town tabs, tappable pins, day/night tint
- [ ] **Step 4** — Places and actions: tap a pin, see actions, data-driven effects on needs and money
- [ ] **Step 5** — Firebase Auth and Firestore: accounts, username, cloud saves
- [ ] **Step 6** — Phone and Jobs: careers, shifts, time windows, ranks, skills
- [ ] **Step 7** — Profile screens: Needs, Goals, Skills, People, Career
- [ ] **Step 8** — Homes, rent (weekly), Buy shop
- [ ] **Step 9** — Multiplayer presence: online count, other players on the map
- [ ] **Step 10** — Avatar: 2D layered first, 3D later
- [ ] **Step 11** — Billboards and ads, top-ups
- [ ] **Step 12** — Deploy to Vercel, polish, landing page and OG image

---

## 5. Decisions log

- TypeScript, no `src/` folder (imports use `@/*` pointing at project root).
- Mobile-first, max width of a phone, full height (`h-dvh`).
- Files are delivered complete, one step at a time.

## 6. Open questions

- Age rule: Lagos Life is 18+ because of open chat. Do we want chat in Osun Life, and for whom?
- Which Osun towns go in the first release?
- Real-money top-ups: yes or no for v1?
