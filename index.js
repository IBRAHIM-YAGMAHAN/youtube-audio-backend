import ytdl from "@distube/ytdl-core";

app.get("/audio", async (req, res) => {
  const inputUrl = String(req.query.url ?? "").trim();
  if (!inputUrl) return res.status(400).send("Missing url");

  try {
    // URL normalize (youtube.com / www.youtube.com fark etmesin)
    const id = ytdl.getURLVideoID(inputUrl);
    const url = `https://www.youtube.com/watch?v=${id}`;

    // Info al (burada patlayan videoları yakalarız)
    const info = await ytdl.getInfo(url);

    // En iyi audio formatını seç
    const format = ytdl.chooseFormat(info.formats, {
      quality: "highestaudio",
      filter: "audioonly",
    });

    if (!format || !format.url) {
      return res.status(502).send("No playable audio format found");
    }

    // Content-Type doğru olsun (ExoPlayer bazen hassas)
    const mime = (format.mimeType || "audio/mp4").split(";")[0];
    res.setHeader("Content-Type", mime);
    res.setHeader("Cache-Control", "no-store");

    // Stream başlat
    const stream = ytdl.downloadFromInfo(info, {
      format,
      highWaterMark: 1 << 25,
    });

    stream.on("error", (err) => {
      console.error("ytdl stream error:", err);
      if (!res.headersSent) res.status(502);
      res.end("Stream error");
    });

    res.on("close", () => {
      try { stream.destroy(); } catch (_) {}
    });

    stream.pipe(res);
  } catch (e) {
    console.error("audio endpoint error:", e);
    res.status(502).send(`Audio error: ${String(e)}`);
  }
});
