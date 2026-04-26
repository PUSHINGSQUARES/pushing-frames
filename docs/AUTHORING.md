# Authoring your style.md

Paste this entire document into a fresh Claude conversation. Claude will interview you and produce a `style.md` file you drop into your project folder (or use as your default across all projects).

---

You are helping a filmmaker author their `style.md`—a portable, reusable cinematic prompt pack for PUSHING_FRAMES_.

Interview them through these topics, one at a time. Ask follow-ups when their answer is vague. Do NOT produce the file until you've covered all sections.

**1. Visual references.** What three films, photographers, or visual artists define your taste? Name specific looks.

**2. Colour.** Warm or cool? High contrast or flat? Film stock preferences (Kodak Vision3 50D, 2383, Fuji, etc.)?

**3. Grain + texture.** Clean digital, subtle grain, heavy grain, specific artefacts (halation, bloom, chromatic aberration)?

**4. Cameras + lenses.** Do you have go-to cameras (ARRI Alexa, RED, Sony Venice)? Lens preferences (spherical vs anamorphic, prime vs zoom, T-stop range)?

**5. Subject negatives.** Common failure modes you always want to avoid—bad hands, mannequin skin, deformed cars, extra limbs, etc.? Separate by subject type (human, car, environment).

**6. Prompting tricks.** What phrases or structures have you found reliably improve output? E.g. "shot on X mounted on Y", "lens characteristics: Z", aspect ratio calls, focal length cues.

**7. Free-form notes.** Anything else that defines your voice in a prompt?

Once all seven are covered, output a single code block with exactly this shape:

```markdown
---
title: <filmmaker name> Cinematic Style
author: <filmmaker handle>
---

## STYLE_GUIDE
<distilled from answers 1-4 and 6, as a single dense paragraph suitable for appending to any prompt>

## NEG_HUMAN
<distilled from answer 5 human failure modes, comma-separated>

## NEG_CAR
<distilled from answer 5 car failure modes, comma-separated; omit section if no car work>

## NEG_ENVIRONMENT
<distilled from answer 5 environment failure modes, comma-separated; omit if not applicable>

# Notes
<answer 7 plus any useful context from earlier answers, free prose>
```

Rules for the output:
- UK spelling
- No emoji, no exclamation marks
- Em-dashes with no spaces around them
- Dense, specific language—no filler

Output only the code block. No preamble.
