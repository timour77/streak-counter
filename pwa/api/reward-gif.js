const CELEBRATION_TAGS = [
  "celebration",
  "success",
  "you did it",
  "high five",
  "yay",
  "achievement unlocked",
  "victory dance",
  "nice job",
];

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const apiKey = process.env.GIPHY_API_KEY;
  const rating = process.env.GIPHY_RATING || "g";
  if (!apiKey) return res.status(200).json({ gif: null });

  try {
    const tag = CELEBRATION_TAGS[Math.floor(Math.random() * CELEBRATION_TAGS.length)];
    const url = `https://api.giphy.com/v1/gifs/random?api_key=${encodeURIComponent(apiKey)}&tag=${encodeURIComponent(tag)}&rating=${encodeURIComponent(rating)}`;
    const giphyRes = await fetch(url);
    if (!giphyRes.ok) return res.status(200).json({ gif: null });
    const data = await giphyRes.json();
    const gif = data?.data?.images?.original?.url || data?.data?.images?.downsized?.url || null;
    res.status(200).json({ gif, title: data?.data?.title || "" });
  } catch {
    res.status(200).json({ gif: null });
  }
}
