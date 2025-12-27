import express from "express";
import cors from "cors";
import yts from "yt-search";
import ytdl from "@distube/ytdl-core";

const app = express();
app.use(cors());

// ✅ Health check
app.get("/health", (req, res) => res.status(200).send("ok"));

// ✅ Search endpoint (ListeningDiscoveryScreen bunu kullanıyor)
app.get("/search-list", async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim();
    const max = Math.min(Number(req.query.max ?? 10), 25);

    if (!q) return res.status(400).json({ error: "Missing q" });

    const r = await yts(q);
    const videos = (r.videos || []).slice(0, max).map((v) => ({
      id: v.videoId,
      title: v.title,
      url: v.url, // https://youtube.com/watch?v=...
      thumbnail: v.thumbnail,
      duration: v.seconds, // int (seconds)
      channel: v.author?.name,
      viewCount: v.views,
    }));

    res.json({ results: videos });
  } catch (e) {
    console.error("search-list error:", e);
    res.status(500).json({ error: String(e) });
  }
});

// ✅ Audio endpoint (EN STABIL): proxy pipe değil, 302 redirect
app.get("/audio", async (req, res) => {
  const inputUrl = String(req.query.url ?? "").trim();
  if (!inputUrl) return res.status(400).send("Missing url");

  try {
    // URL normalize (youtube.com / www.youtube.com vs)
    const id = ytdl.getURLVideoID(inputUrl);
    const url = `https://www.youtube.com/watch?v=${id}`;

    // Video info al
    const info = await ytdl.getInfo(url);

    // 1) audioonly + highestaudio
    let format = ytdl.chooseFormat(info.formats, {
      quality: "highestaudio",
      filter: "audioonly",
    });

    // 2) fallback: audioonly bulunamazsa highestaudio
    if (!format || !format.url) {
      format = ytdl.chooseFormat(info.formats, { quality: "highestaudio" });
    }

    if (!format || !format.url) {
      console.error("No playable format", {
        id,
        title: info.videoDetails?.title,
      });
      return res.status(502).send("No playable format found");
    }

    // ✅ En stabil çözüm: Google'ın stream URL'ine yönlendir
    return res.redirect(302, format.url);
  } catch (e) {
    console.error("audio redirect error:", e);
    return res.status(502).send(`Audio error: ${String(e)}`);
  }
});

// ✅ Render için PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log("Listening on", PORT));
