import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { processMessage } from "./src/engine/conversationEngine.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const CONFIG_DIR = path.join(__dirname, "config", "businesses");

function loadBusiness(businessId) {
  const file = path.join(CONFIG_DIR, `${businessId}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

// Lista qué negocios hay configurados (para el selector del chat de prueba)
app.get("/api/businesses", (req, res) => {
  const files = fs.readdirSync(CONFIG_DIR).filter((f) => f.endsWith(".json"));
  const businesses = files.map((f) => {
    const b = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, f), "utf-8"));
    return { businessId: b.businessId, displayName: b.displayName };
  });
  res.json(businesses);
});

// Endpoint del canal de prueba web: mismo motor que usaría WhatsApp
app.post("/api/chat", (req, res) => {
  const { businessId, customerId, customerName, message } = req.body;
  const business = loadBusiness(businessId);
  if (!business) return res.status(404).json({ error: "Negocio no encontrado" });

  const reply = processMessage(business, customerId, customerName, message);
  res.json({ reply });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Turnero bot corriendo en http://localhost:${PORT}`);
});
