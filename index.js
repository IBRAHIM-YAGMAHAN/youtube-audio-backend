const express = require("express");
const cors = require("cors");
const ytdlp = require("yt-dlp-exec");
const { spawn } = require("child_process");

const app = express();
app.use(cors());

// Çoklu arama - liste döndürür
app.get("/search-list", async (req, res) => {
    const query = req.query.q;
    const maxResults = req.query.max || 10; // Varsayılan 10 sonuç
    
    if (!query) return res.status(400).json({ error: "Query eksik" });

    try {
        // YouTube'da arama yap, birden fazla sonuç getir
        const result = await ytdlp(`ytsearch${maxResults}:${query}`, {
            dumpSingleJson: true,
            flatPlaylist: true,
        });

        // Eğer playlist dönerse entries'i al, değilse tek video olarak sarma
        const videos = result.entries || [result];
        
        const videoList = videos.map(video => ({
            id: video.id,
            title: video.title,
            url: video.webpage_url || video.url,
            thumbnail: video.thumbnail || video.thumbnails?.[0]?.url,
            duration: video.duration,
            channel: video.uploader || video.channel,
            viewCount: video.view_count,
        }));

        res.json({ results: videoList });
    } catch (err) {
        console.error("Arama hatası:", err);
        res.status(500).json({ error: "Arama başarısız" });
    }
});

// Tek video bilgisi al
app.get("/video-info", async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: "URL eksik" });

    try {
        const info = await ytdlp(url, {
            dumpSingleJson: true,
            noWarnings: true,
        });

        res.json({
            title: info.title,
            url: info.webpage_url,
            thumbnail: info.thumbnail,
            duration: info.duration,
            description: info.description,
        });
    } catch (err) {
        console.error("Video info hatası:", err);
        res.status(500).json({ error: "Video bilgisi alınamadı" });
    }
});

// Audio stream
app.get("/audio", async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).send("URL eksik");

    try {
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Content-Disposition", 'inline');

        const ytdlpProcess = spawn('yt-dlp', [
            '-f', 'bestaudio',
            '-x',
            '--audio-format', 'mp3',
            '--audio-quality', '5',
            '-o', '-',
            url
        ]);

        ytdlpProcess.stdout.pipe(res);

        ytdlpProcess.stderr.on('data', (data) => {
            console.error(`yt-dlp stderr: ${data}`);
        });

        res.on('close', () => {
            ytdlpProcess.kill('SIGKILL');
        });

    } catch (err) {
        console.error("Hata:", err);
        res.status(500).send("Stream başlatılamadı");
    }
});

const PORT = 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Backend http://localhost:${PORT} adresinde hazır!`);
});