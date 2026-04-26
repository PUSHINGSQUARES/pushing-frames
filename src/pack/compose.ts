import type { Pack, Shot } from './types'

// Universal lead. Every modern gen model has trained on captioned stock
// content, so they readily render any "ISO 200 / 50mm / Mini LF" metadata
// in the prompt as in-frame caption text. This explicit lead tells the
// model to treat the brief as cinematographic direction, not as a caption
// to overlay. Goes at the start so it weights highest. Video-aware so
// video models don't get pushed toward stills by "photograph" wording.
const PHOTO_LEAD = 'Render as a clean photograph. Do not display any text, captions, watermarks, ISO/lens/camera/aspect labels, location tags, or HUD elements in the image. The brief below is direction for how to capture the scene, not text to overlay. '
const VIDEO_LEAD = 'Render as a clean cinematic video clip. Do not display any text, captions, watermarks, ISO/lens/camera/aspect labels, location tags, or HUD elements in the frame. The brief below is direction for how to capture the shot, not text to overlay. '

export function composePrompt(pack: Pack, shot: Shot): string {
  const isVideo = !!shot.video_mode
  const lead = isVideo ? VIDEO_LEAD : PHOTO_LEAD
  const styleBodies = shot.styleBlocks.map(n => pack.blocks.find(b => b.name === n)?.body ?? '').filter(Boolean)
  const negBodies = shot.negBlocks.map(n => pack.blocks.find(b => b.name === n)?.body ?? '').filter(Boolean)
  // The camera/lens/aspect chip values used to prepend as a comma-list
  // header. Every image model read that as a caption to render in-frame,
  // baking "ISO 200" / "Mini LF handheld" text onto generated images. The
  // action body already carries the camera info via the "Shot on [camera]
  // mounted on [rig]" lead the templates direct, and aspect rides in each
  // adapter's separate size/ratio parameter — so the comma header is safe
  // to drop.
  const positive = [lead + shot.action, ...styleBodies].filter(Boolean).join(' ')
  // Aspect at the end as a natural-language cue. The API's size parameter
  // is the load-bearing aspect signal for most providers, but Gemini Nano
  // Banana and a few others don't accept size and rely on the prompt for
  // framing — so we always include this. Goes after style bodies so it's
  // not read as a caption header.
  const aspectCue = shot.aspect ? ` Composed for a ${shot.aspect} frame.` : ''
  const negative = negBodies.length > 0
    ? `\n\nNegative prompt: rendered text, captions, watermarks, on-screen labels, HUD overlays, ${negBodies.join(', ')}`
    : '\n\nNegative prompt: rendered text, captions, watermarks, on-screen labels, HUD overlays'
  return positive + aspectCue + negative
}
