import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new DatabaseSync(path.join(__dirname, "..", "..", "data.sqlite"));

// Una fila por turno agendado
db.exec(`
CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  businessId TEXT NOT NULL,
  customerId TEXT NOT NULL,
  customerName TEXT,
  serviceId TEXT NOT NULL,
  date TEXT NOT NULL,        -- formato YYYY-MM-DD
  time TEXT NOT NULL,        -- formato HH:MM
  status TEXT NOT NULL DEFAULT 'confirmed', -- confirmed | cancelled
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// Una fila por conversación activa: en qué paso del flujo está cada cliente
db.exec(`
CREATE TABLE IF NOT EXISTS conversation_state (
  customerId TEXT NOT NULL,
  businessId TEXT NOT NULL,
  step TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}', -- JSON con lo que se fue juntando (servicio elegido, fecha, etc.)
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (customerId, businessId)
);
`);

export default db;
