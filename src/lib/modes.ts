export type AIMode = { id: string; name: string; category: string; prompt: string; thumb?: string | undefined; tile?: number | undefined; enabled?: boolean | undefined };

export const CATEGORIES = ["Toys", "Cartoon", "Art", "Cinematic"];

const P = (s: string) => s;
export const DEFAULT_MODES: AIMode[] = [
  { id: "lego", name: "LEGO", category: "Toys", tile: 0, prompt: P("Transform this photo into a detailed LEGO brick diorama, every element built from glossy LEGO bricks and minifigures, keep composition and identity.") },
  { id: "figure", name: "Action Figure", category: "Toys", tile: 3, prompt: "Turn the subject into a collectible action figure inside a premium toy blister box with accessories." },
  { id: "clay", name: "Clay", category: "Toys", tile: 4, prompt: "Recreate this photo as a claymation stop-motion scene made of plasticine with fingerprint texture." },
  { id: "funko", name: "Funko Pop", category: "Toys", tile: 10, prompt: "Turn the subject into a Funko Pop vinyl figure with oversized head." },
  { id: "plush", name: "Crochet", category: "Toys", tile: 12, prompt: "Turn the subject into a cute knitted crochet plush toy, soft yarn texture." },
  { id: "sticker", name: "Sticker", category: "Toys", tile: 14, prompt: "Turn the subject into a die-cut glossy cartoon sticker with a thick white border." },
  { id: "pixar", name: "Pixar 3D", category: "Cartoon", tile: 1, prompt: "Transform this photo into a Pixar-style 3D animated movie still, soft cinematic lighting, keep likeness." },
  { id: "ghibli", name: "Ghibli", category: "Cartoon", tile: 2, prompt: "Redraw this photo in Studio Ghibli hand-painted anime style, warm watercolor backgrounds." },
  { id: "simpsons", name: "Simpsons", category: "Cartoon", tile: 5, prompt: "Redraw this photo in The Simpsons cartoon style, yellow skin, bold outlines." },
  { id: "anime", name: "Anime", category: "Cartoon", tile: 6, prompt: "Convert this photo into a high quality modern anime key visual, vibrant colors." },
  { id: "pixel", name: "Pixel Art", category: "Cartoon", tile: 7, prompt: "Convert this photo into detailed 16-bit pixel art, retro game palette." },
  { id: "comic", name: "Comic", category: "Cartoon", tile: 13, prompt: "Redraw this photo as a Marvel-style comic book panel with halftone dots." },
  { id: "sketch", name: "Sketch", category: "Art", tile: 8, prompt: "Convert this photo into a realistic graphite pencil sketch on textured paper." },
  { id: "oil", name: "Oil Paint", category: "Art", tile: 9, prompt: "Repaint this photo as a classical oil painting with visible brush strokes." },
  { id: "statue", name: "Marble", category: "Art", tile: 15, prompt: "Transform the subject into a classical white marble statue in a museum." },
  { id: "cyber", name: "Cyberpunk", category: "Cinematic", tile: 11, prompt: "Restyle this photo as a neon cyberpunk night scene, rain reflections, cinematic." },
  { id: "golden", name: "Golden Hour", category: "Cinematic", prompt: "Relight this photo with warm golden hour sunlight, soft long shadows, natural tone." },
  { id: "studio", name: "Studio", category: "Cinematic", prompt: "Turn this into a professional studio portrait with softbox lighting and clean seamless backdrop." },
  { id: "film", name: "35mm Film", category: "Cinematic", prompt: "Make it look shot on Kodak Portra 400 35mm film, fine grain, natural colors." },
  { id: "restore", name: "Restore", category: "Cinematic", prompt: "Restore and enhance this photo: remove noise and blur, sharpen details, natural colors, high resolution." },
  { id: "removebg", name: "Remove BG", category: "Cinematic", prompt: "Remove the background completely and place the subject on a clean pure white studio background." },
];
