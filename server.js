const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const HF_TOKEN = process.env.HF_TOKEN;
const MODEL = process.env.MODEL || "black-forest-labs/FLUX.1-schnell";
const API_URL = `https://router.huggingface.co/hf-inference/models/${MODEL}`;

app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public")));

const hits = new Map();
function rateLimit(req, res, next) {
  const ip = req.headers["x-forwarded-for"] || req.ip;
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 60000);
  if (list.length >= 6) {
    return res.status(429).json({ error: "Çok hızlısın, bir dakika bekle." });
  }
  list.push(now);
  hits.set(ip, list);
  next();
}

app.post("/api/generate", rateLimit, async (req, res) => {
  const prompt = String(req.body.prompt || "").trim();
  if (prompt.length < 3) {
    return res.status(400).json({ error: "Biraz daha uzun bir açıklama yaz." });
  }
  if (prompt.length > 500) {
    return res.status(400).json({ error: "Açıklama en fazla 500 karakter olabilir." });
  }
  if (!HF_TOKEN) {
    return res.status(500).json({ error: "Sunucuda HF_TOKEN tanımlı değil." });
  }

  try {
    const r = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
        Accept: "image/png",
      },
      body: JSON.stringify({ inputs: prompt }),
    });

    if (!r.ok) {
      const text = await r.text();
      console.error("HF hata:", r.status, text);
      const msg =
        r.status === 503
          ? "Model uyanıyor, 20 saniye sonra tekrar dene."
          : "Görsel oluşturulamadı.";
      return res.status(502).json({ error: msg });
    }

    const buf = Buffer.from(await r.arrayBuffer());
    res.set("Content-Type", r.headers.get("content-type") || "image/png");
    res.send(buf);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Sunucu hatası." });
  }
});

app.listen(PORT, () => console.log(`Çalışıyor: ${PORT}`));
