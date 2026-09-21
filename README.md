# Eric's Collection & Wish List

A personal log of what I own and a wish list of what I don't, across five
shelves: vinyls, Blu-rays, books, LEGO and Switch 2 games.

Pick a shelf from the home page, scroll the feed two-up, and flip between
**wants** and **owns** with the pill at the bottom. It opens on the wish list,
and the page says which side you are looking at underneath the shelf's name.
Tap anything on the wants side and it offers a link to go buy it, at a shop
chosen per shelf. Things you already own carry no links at all — you have it,
there is nothing to go and do.

The orange plus is on every page, the home page included; from there it asks
which shelf first.

## Running it

```sh
npm install
npm run dev
```

Then open the address it prints. That's the whole thing — it works straight
away, with no accounts and no setup.

Before any of the setup below, your collection is saved **in one browser on one
device**. The home page says so at the bottom. Everything works; it just isn't
syncing anywhere yet, and clearing your browser would take the collection with
it.

## Cover art finds itself

Type a title and the cover appears on its own, a beat after you stop typing.
Nothing is ever overwritten: the lookup only fills fields you left blank, and
once you touch the cover box by hand it stops interfering. "Not this one" under
the picture clears it and goes again.

| Shelf | Looks in | Keys on |
| --- | --- | --- |
| Vinyls | Apple Music | title + artist |
| Blu-rays | TMDB | title |
| Books | Open Library | title + author |
| LEGO | Rebrickable, then BrickLink | the set number |
| Switch 2 Games | — | nothing; paste a URL |

All free, and none of them needs an account except TMDB — see below.

**Switch games are the exception.** Nintendo publishes no open catalogue and
their site refuses cross-origin requests, so those covers are pasted in by hand.
The form says so rather than looking broken. A set with no cover isn't a hole:
the card sets the title in large type on sand, which is a designed state.

### The one key: TMDB, for Blu-ray covers

Free, and you already have a token — it's the long string on the
`const TOKEN = '...'` line in `movies-viz/picker.html`. Copy it into
`.env.local` here as:

```
VITE_TMDB_TOKEN=<that string>
```

Without it, films simply don't autofill their covers. Nothing else changes, and
the other four shelves are unaffected.

## Cutting the white background out

Box shots usually come on plain white, which puts a white rectangle in the
middle of a warm page. Tick **Cut the white background out** under the cover and
the surround is removed. Those covers also lose their container — no frame, no
tile, no shadow, on the feed and on the item's own page — so the box sits
directly on the paper.

It works by flooding inwards from the four edges of the picture and clearing
anything near-white it can reach. Starting from the edges is the whole trick:
white *inside* the picture — a sky, a logo, a white brick — isn't connected to
the border, so it survives.

**Some picture hosts refuse, so those go the long way round.** Reading another
site's pixels is something that site has to permit. Open Library, Apple Music and
BrickLink do; TMDB, Rebrickable and most shops don't. A refused picture is
fetched again through [wsrv.nl](https://wsrv.nl), a free image service that
re-serves any public picture with permission to read it, and cut out from that.
The preview under the cover box always shows what you'll actually get.

If even that fails, a light theme still gets most of the way there: the picture
is multiplied against the page, and white against warm paper simply disappears.
That trick can't work on a dark background, so in a dark theme those pictures
are shown whole rather than turned to mud.

**Sizes are standardised.** Stock photographs frame their subject differently —
one case fills the frame, the next floats in a sea of white — so cutting the
background out isn't enough on its own: the empty space is still there as
transparent pixels, and fitting that to a tile scales every box differently. So
each cut-out is cropped to the object itself and then re-drawn to match its
neighbours **by height**, which is what actually matches on a real shelf. Two
photographs of the same case, one tightly framed and one loose, now come out
within a percent of each other.

An unusually wide object — a case photographed at an angle, a boxed set, a
Concorde — gives up some height rather than run off the sides. That is why
cut-out covers sit in a wider tile than photographs do.

Nothing is stored. A cut-out PNG runs to several hundred kilobytes, which would
be far too much to keep per item, so it is redone from the original each time —
about 30ms, and only for the covers actually on screen.

## The crate view (Vinyls)

The two small icons at the top right of the Vinyls page switch between the grid
and the **crate**: one record at a time, front and centre, with the tops of the
next seven showing above it, smaller and darker the further back they sit. Pull
the front record down with your thumb and it tips forward and drops away, the
next one comes forward, and the one you pulled goes round to the back — the
crate never runs out, it comes round again. Push up to bring the last one back.
A quick flick goes through several. Tap the front record to open it, or the
top of one behind to bring it straight to the front. On a computer, the scroll
wheel and the arrow keys do the same. Each device remembers which view you
last used. Tabs and filters still apply: the crate holds whatever the grid
would show.

## The bookshelf view (Books)

The Books page has the same switch at the top right: the grid, or the
**bookshelf**. The bookshelf gives each kind its own shelf — Novels, Coffee
Table, Graphic Novels, Cookbooks, in that order, and a last one for anything
not given a kind yet. Books stand **spine out**, the way they do on a real
shelf: each spine is the main colour of its own cover (worked out from the
picture, once, and remembered), with the title running down it, and each book
a little different in height and thickness. One book per shelf stands
**face-out**. Tap a spine and that book turns round to face you; tap the
face-out book and its details and buy buttons come up under the shelf. Each
shelf scrolls sideways with the phone's own swipe; up and down moves between
shelves. The filter tabs step aside in this view, since the shelves do their
job. The shelf order lives in `shelfRows` in `src/categories.ts`.

## Adding from a link or a photo

The top of every Add form says **Fill it in for me**: **Take picture** and
**Upload picture** side by side, and under them a box that says *Paste a link*.

**Paste a link** into that box — any shop's product page: Rough Trade, Gruv,
McNally Jackson, LEGO, Nintendo, anywhere. It's read the moment it lands; there's
no button to press. (Pasting a link into Title does the same.) The page is read and the form fills in: the title, the
artist / director / author / theme / publisher, the year, the cover, and the
link itself, which becomes the buy button. What's left is the tag.

**Take or upload a picture.** Photograph the cover, or pick a picture you already
have. It starts being read straight away, and the form asks **which shop it's
from** — pre-filled with the shelf's usual shop, then whichever you used last.
**Find it there** finds the shop's website, the item on it, and takes that
page's link and cover, exactly as if you'd pasted its address. **Skip** leaves
the link to the shelf's usual shop and takes the cover from a catalogue. The
title and maker appear in the form as soon as the picture is read, before the
shop search finishes.

Books are found on a bookshop's site by ISBN, edition by edition, which is how
most American bookshops (McNally Jackson, Books Are Magic, Powell's) address
their pages. Shopify shops like Gruv are asked through their own product search,
and anything else through a web search limited to that shop's site. If the shop
doesn't have it, the cover comes from the usual free catalogue and the link is
left blank, and the form says so.

**Covers are cut out where the rest of the shelf is.** Blu-rays and LEGO sets are
boxes, cut out and stood at a common height, so a new one arrives cut out too.
Records, books and games are artwork edge to edge, and are left whole — cutting
Rumours took out the white it's photographed on.

**How it's done, and what it costs: nothing.**

- *Reading pages* goes through [Jina's reader](https://jina.ai/reader), free and
  keyless, about twenty pages a minute — adding one thing uses three to eight.
  If it says it's busy, wait a minute. Microlink stands in when a page won't read.
- *Searching* is DuckDuckGo, read the same way.
- *Reading photos*, and tidying shop titles like "Rumours - Vinyl, CD | Rough
  Trade - (LP - Black, 2LP - Black)", is **Gemini**, through Firebase AI Logic on
  the collection's own Firebase project. That uses Google's free tier: the
  project is on the no-cost Spark plan with no card attached, so it can't be
  billed — past the free daily allowance it simply says no. Google may use what's
  sent on the free tier to improve its products; here that's photos of book
  covers and public shop pages. Without Gemini, links still work (the titles are
  tidied by rule instead) but photos don't.

**Switching Gemini on (once):** [Firebase console](https://console.firebase.google.com/project/eric-s-wish-list/ailogic/)
→ **AI Logic** → **Get started** → choose **Gemini Developer API** (the free one —
*not* Vertex AI, which needs billing) → follow it through. Skip App Check.

## Where the buy links go

Every item has an optional link box. Leave it blank and a wanted item falls back
to the shop that suits the shelf. Paste anything in and that wins — and the
button renames itself to that shop, so a Rough Trade URL gives you a button
reading "Rough Trade".

| Shelf | Goes to | What kind of link |
| --- | --- | --- |
| Vinyls | Rough Trade | a search |
| Blu-rays | Gruv | a search |
| Books | McNally Jackson | the exact book, by ISBN |
| LEGO | LEGO.com, then BrickLink | the exact set, by set number |
| Switch 2 Games | Nintendo | a search |

None of this appears on something you already own.

Vinyls get their own wording, since the shop is the second answer: the page says
**Your local record store, or** above the Rough Trade button.

Two of these land on the product itself rather than a search:

- **LEGO.** Searching lego.com for a set number redirects straight to that set's
  page, retired ones included. BrickLink sits underneath for sets LEGO no longer
  lists at all. Both need the number — "Atari 2600 Icons" finds nothing on
  either, `10306` finds it instantly.
- **Books.** McNally Jackson's product pages are keyed on ISBN, so the lookup
  goes and finds one. It prefers a printed edition over an ebook and a US
  printing over a foreign one, because the wrong edition's ISBN gives a
  not-found page. It is a good guess, not a guarantee — their site has no
  linkable search to fall back on — so a Bookshop.org link, which always
  resolves, sits underneath.

### What would take a server

You asked whether the app could check each title at Rough Trade, Gruv and
McNally Jackson as you add it, and link the product page only if it's really in
stock. It can't, from the browser: all three refuse cross-origin requests, which
is the ordinary arrangement and not something to work around from this side.
Doing it properly needs a small server of our own making the request. That's the
same thing the LEGO-account and eShop syncing below would need, so it's one
piece of work, not three.

## Tags

Two shelves tag their things, from chips on the form, shown on the item's page:

- **Vinyls — Acquired:** Thrift, Brand New, Stoop, Travelling, Gifted.
- **Blu-rays — Preferred version:** Steelbook, Criterion, 4K, Regular Blu-ray.

On a tagged shelf the tag is what the feed caption shows, in place of the maker
and year: **Her** / Steelbook, **Rumours** / Thrift. It says more at a glance
than the director does, and it is the thing you are actually scanning for.
Untagged items keep the maker and year. On an item's own page the tag sits in a
soft pill — shaped like the chip it was chosen from, but inert: no border, no
hover, no pointer, because tapping it does nothing.

A tagged shelf also gets **filter tabs** under the rule — All, then one per tag
with a count. A tag nothing on the current side carries is left out rather than
offered, so the row never leads to an empty shelf, and the choice resets when
you change shelves.

Blu-rays word their tag by which side it is on: a wanted disc has a *Preferred
format*, because that is a wish; one on the shelf just has a *Format*. That's a separate control and worth adding once there's enough on a
shelf to need it. The mechanism is one field in `categories.ts`, so giving
another shelf its own tags is a three-line change.

## Adding a lot at once

**Paste a list** — on the add form, and on any empty shelf — takes a pasted list
of titles, one a line, and fills in everything it can find: cover, year, the
artist or author, a book's ISBN.

It copes with how lists actually get pasted. Bullets, numbers and checkboxes are
stripped off the front in any combination, and an artist after a dash or the
word "by" is split off:

```
1. Kind of Blue - Miles Davis
2. Purple Rain — Prince
- Graceland by Paul Simon
[ ] Blade Runner
- [x] In the Mood for Love
The Velvet Underground & Nico
```

All six of those import correctly. Brackets are only taken off the *front* of a
line — a title like `The Heat [DVD]` keeps them, because there they are part of
the name. For LEGO, paste the set numbers rather than
the names — that's what everything is keyed on. Each row reports whether a cover
was found as it goes, and anything that comes up empty is still added, just
bare.

On a shelf page the top-left is a menu rather than a back arrow: going back
only ever meant the home page, which is itself a list of shelves, so the menu is
that list one tap earlier.

## Prepared lists

`src/prepared.ts` holds two lists ready to add in one tap, from the **Paste a
list** screen of the shelf they belong to: 24 Blu-rays owned, and 31 books
wanted. They live in code rather than only in a browser for a blunt reason —
until the Firestore setup below is done, the collection sits in one browser's
storage and can be lost. A list kept here can always be put back.

Blu-ray covers come from blu-ray.com, which has every release and lets its
pixels be read, so they cut out and match in size like anything else. They are
flat sleeve art rather than photographs of cases on white: no source with
three-dimensional case shots covers the whole list — gruv, the shop this app
prefers, has good ones but only stocks about a third of these titles.

Book covers and ISBNs come from Open Library. Each ISBN was checked against
McNally Jackson before being kept, so a book that carries one has a buy button
that goes straight to their page for it; the rest fall back to Bookshop.

## Putting it online

The aim: the collection follows you between your laptop and your phone, and a
link you send to anyone else lets them look but change nothing.

Three things make that work — a Firebase project to hold the data, a Google
sign-in so the app knows you are you, and GitHub Pages to serve the site.

### 1. Firebase

**Use a project of its own, not the Blokus one.** An earlier draft of this file
said to share it, to save a signup. That was a bad trade: two unrelated apps in
one project means one rules file holding both sets of rules, and every edit
carries a chance of breaking the other app. A second project is free, takes a
few minutes, and keeps the two entirely apart — different rules, different
sign-in settings, and either can be wiped without touching the other.

At [console.firebase.google.com](https://console.firebase.google.com):

- **Create a project.** Turn Google Analytics **off**; nothing here uses it. The
  free Spark plan is enough and no card is needed.
- **Databases & Storage → Firestore → Create database.** Take *Firestore*,
  under the **NoSQL** heading — not the *Storage* entry below it, which is file
  storage this app never touches and whose page demands a pricing upgrade, which
  is easy to read as "this project needs a paid plan". It doesn't.

  Standard edition. Leave the database ID as `(default)`: the app calls
  `getFirestore(app)`, which resolves to the default database, and a custom ID
  leaves it connecting to something that isn't there — with an error that looks
  like a permission failure rather than a missing database. Any US region;
  **the location cannot be changed later**. Production mode, since test mode
  expires after 30 days and the rules are replaced in step 3 anyway.
- **Security → Authentication → Sign-in method → Google → Enable.** Pick your
  address as the support email. Anonymous sign-in is deliberately *not* used: on
  a public site it would let any visitor write.
- **Security → Authentication → Settings → Authorized domains → Add domain**,
  and add `ericnichols32.github.io`. Google sign-in redirects through this list and
  fails without it. (Blokus never needed this, because anonymous sign-in ignores
  the list — this is the one real difference from that setup.)
- **Settings → General**, then scroll to **Your apps** and click the web icon
  (`</>`). There is no separate "Project settings" entry — the gear menu opens
  straight onto these tabs, and General is the one that holds the apps. Register
  the app,
  and copy the four values out of the `firebaseConfig` block it shows.

### 2. Find your user id

```sh
cp .env.example .env.local
```

Fill the four Firebase values into `.env.local`, then:

```sh
npm run dev
```

Open the app and press **Sign in to edit**. Because no owner is set yet, the
home page prints your user id. Then:

- put it in `.env.local` as `VITE_OWNER_UID=…`
- put the same id into `firestore.rules`, replacing `PASTE_YOUR_UID_HERE`, then
  paste that whole file into **Databases & Storage → Firestore → Rules** in the
  console and publish. With a project of its own there is nothing to merge around: the file
  is the whole ruleset.

Restart `npm run dev`. You can now edit; a signed-out visitor cannot.

### 3. GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds and publishes on every
push to `main`. It needs the same values as repository secrets:

```sh
gh secret set VITE_FIREBASE_API_KEY
gh secret set VITE_FIREBASE_AUTH_DOMAIN
gh secret set VITE_FIREBASE_PROJECT_ID
gh secret set VITE_FIREBASE_APP_ID
gh secret set VITE_OWNER_UID
gh secret set VITE_TMDB_TOKEN
```

Then **Settings → Pages → Source: GitHub Actions**, once.

### What this buys, and what it does not

Reading is open to anyone with the link, on purpose — a shelf of records and
books is not private, and making visitors sign in to look would defeat the
point. Writing belongs to one account, enforced by Google's servers in
`firestore.rules`, not by the app hiding buttons. A stranger who opens the site
and signs into their own Google account is refused before anything of yours is
touched.

The app hides what it knows will fail, which is a courtesy rather than the lock.
`?share` on the end of the URL puts your own copy into read-only mode, so you
can see what everyone else sees.

## Your phone

Open the Pages URL, sign in with the same Google account, and it is the same
collection. Add it to the home screen if you want it to behave like an app.

To run a local copy against the network instead, `npm run dev -- --host` and use
the address it prints.

## LEGO and Nintendo wish lists, synced hourly

The LEGO wish list here mirrors your wish list on LEGO.com, and the Video Games
wish list mirrors your Nintendo one. Every hour `scripts/sync-lego.mjs` and
`scripts/sync-nintendo.mjs` read them and:

- **adds** any set that is new on LEGO — name, set number, theme, a link to the
  product page, and LEGO's own picture
- **removes** a set this script added once it has left your LEGO wish list

It never touches anything else. A set you move to the **Collection** is kept
even after it leaves LEGO's list — you bought it. A set you typed in by hand is
never removed. A set already on the shelf is never added twice. Those rules are
tested in the script itself.

### Why it runs on the Mac, not on GitHub

LEGO refuses its wish list to datacentres: a GitHub Actions runner asking for it
gets a 403, while an ordinary home connection gets the list. That is LEGO's
rule and the script does not try to get round it — from your Mac it is no
different from opening the wish list in a browser once a day.

So it is a macOS scheduled job, run hourly. Asleep, it catches up on waking;
switched off, it resumes when switched on — every run compares the whole list,
so a missed one loses nothing. Nintendo's API has the same arrangement.

### The pictures

LEGO's own product pictures, linked straight from LEGO. They already come with
a transparent background and a tight frame, so there is nothing to cut out and
nothing to copy.

(An earlier version copied every picture into the site so the cut-out could run
on it — LEGO's image server refuses to let a browser read its pixels. It turned
out they never needed cutting out, and the copies were distorted besides:
without `fit=bounds`, LEGO's server stretches a picture to fill the exact size
asked for. Both are gone.)

### Setting it up

It needs to be allowed to write to Firebase. Your own sign-in can't be used from
a scheduled job, so it uses a **service-account key** — a file that lets the
script act as the project's administrator.

1. Firebase → **Settings → Service accounts** → **Generate new private key**.
   It downloads a `.json` file.
2. Move it into place:

   ```sh
   mkdir -p ~/.config/shelf && mv ~/Downloads/eric-s-wish-list-*.json ~/.config/shelf/service-account.json
   ```

3. Run it once to check:

   ```sh
   zsh scripts/install-sync.sh --now
   ```

**Treat that key like a password.** It can do anything to the database,
bypassing the rules. It lives in your home folder, never in this repo, and is
never uploaded anywhere. If it leaks, delete it under Service accounts and make
a new one.

Other commands:

```sh
node scripts/sync-lego.mjs --dry-run        # say what would change, change nothing
node scripts/sync-nintendo.mjs --dry-run    # same, for Nintendo
zsh scripts/install-sync.sh --remove        # stop both syncs for good
tail -50 ~/Library/Logs/shelf-sync.log      # what they did recently
```

### Nintendo is a snapshot, not a live list

Nintendo's share link has the games written into the link itself
(`…/share/#skus=7100112715,7100098088,…`), and it never changes afterwards —
Nintendo's own page calls it "a snapshot of my Wish List". So there is nothing
live to watch the way there is with LEGO.

When your Nintendo wish list changes, share it again on Nintendo's site and
paste the new link into **Video Games → + → Paste a list** — the box at the
top. It's saved in Firestore (`settings/nintendo`), and the next hourly run adds
the new games and removes the dropped ones. Prices update every hour regardless.

Each game arrives with its title, publisher, release year, price, a link to its
store page, Nintendo's square cover, and its console — Nintendo Switch or
Nintendo Switch 2 — which is exactly the shelf's Console tag, so the filters
work with no setup.

Two quirks the script handles: Nintendo's API only answers requests carrying an
`apollographql-client-name` header (without it, every request is a 500), and it
now and then answers "Unauthorized" with no data, then works seconds later — so
each request is tried three times before a run gives up, and giving up changes
nothing.

The LEGO **Collection** is not synced — there is no public list of what you own.
Five sets are in `src/prepared.ts`, loaded from the LEGO *Paste a list* screen.

## What isn't built yet

**Search and sort within a shelf.** Fine at thirty items, wanted at three
hundred.

**Anything offline.** Open it without a signal once syncing is on and you get an
empty shelf.

## How it's put together

```
src/
  categories.ts     the five shelves: labels, cover shapes, tags, where to buy
  lookup.ts         finding cover art, one source per shelf
  quickadd.ts       filling a new item in from a link or a photo
  web.ts            reading shop pages and searching, through Jina's reader
  ai.ts             Gemini, through Firebase AI Logic
  stores.ts         from a shop's name to its website
  cutout.ts         taking the white background off a cover
  types.ts          what an item is, and migrating older saved ones
  route.ts          hash routing, and share mode
  backend/
    index.ts        picks a store — cloud if configured, this browser if not
    firebase.ts     Firestore, loaded only when it's actually configured
    local.ts        localStorage
  components/       home, feed, card, detail, form
  samples.ts        the "load a few samples" set, for an empty shelf
  styles.css        the design tokens live at the top
firestore.rules     who can read and write, and why
```

The look is lifted from [the-cafelist.com](https://the-cafelist.com): warm paper,
one terracotta accent, Libre Caslon for titles, Source Serif for reading, Space
Mono for anything in small caps. Those five colours are the first thing in
`styles.css` if you want to move them.
