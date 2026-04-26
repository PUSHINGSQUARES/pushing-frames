# PUSHING FRAMES_

Local, bring-your-own-keys cinematic prompt studio. Image and video
generation across Seedream 4, Seedance 2, GPT-image-2, Gemini 3 Flash
Image, Imagen, Veo 3, Kling, OpenRouter—behind one cinematic-first UI.
The pack is the product: every project is a markdown file you can read,
edit, remix, commit to git, share.

## Quick start

```
git clone <your-fork>
cd pushing-frames
npm install
npm run dev
```

Open the dev URL, set a vault passphrase, paste your provider keys.
Keys are encrypted locally with the passphrase and stored in IndexedDB.
They never leave your machine.

## What's inside

- `src/templates/cinematography/style.md` — curated STYLE_/NEG_ block
  library to fight common AI failure modes
- `src/templates/bmw/` — annotated worked example pack with 6 shots
- `docs/AUTHORING.md` — interview protocol you can paste into Claude or
  Gemini to author your own master pack
- `docs/example_master_pack.md` — Ari's master pack as a starting point

## How to use the pack format

The Project Guide walks you through it: pick a template, write a brief,
add references, generate a shot list. Or open an existing folder with a
`style.md` plus `storyboard.md` and skip the guide.

## Constraints

- Pure browser, no install step (Phase 1)
- Bring-your-own keys for every provider
- Cost-aware—pre-flight estimates and project budget caps
- Reference images conformed per-provider before send
- Phase 2 macOS desktop wrapper planned for Finder integration

## License

MIT. See LICENSE.
