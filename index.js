import express from "express";
import cors from "cors";
import yts from "yt-search";
import ytdl from "@distube/ytdl-core";

const app = express();
app.use(cors());

app.get("/health", (req, res) => res.status(200).send("ok"));

app.get("/search-list", async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim();
    const max = Math.min(Number(req.query.max ?? 10), 25);
    if (!q) return res.status(400).json({ error: "Missing q" });

    const r = await yts(q);
    const videos = (r.videos || []).slice(0, max).map(v => ({
      id: v.videoId,
      title: v.title,
      url: v.url,
      thumbnail: v.thumbnail,
      duration: v.seconds,
      channel: v.author?.name,
      viewCount: v.views
    }));

    res.json({ results: videos });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/audio", async (req, res) => {
  try {
    const url = String(req.query.url ?? "").trim();
    if (!url) return res.status(400).send("Missing url");
    if (!ytdl.validateURL(url)) return res.status(400).send("Invalid YouTube URL");

    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Type", "audio/mp4");

    const stream = ytdl(url, {
      filter: "audioonly",
      quality: "highestaudio",
      highWaterMark: 1 << 25
    });

    stream.on("error", err => {
      console.error("ytdl stream error:", err);
      if (!res.headersSent) res.status(500);
      res.end("stream error");
    });

    stream.pipe(res);
  } catch (e) {
    res.status(500).send(String(e));
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log("Listening on", PORT));
