import db from "../db/db.js";
import { nanoid } from "nanoid";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function toHHMM(mins) {
  const h = String(Math.floor(mins / 60)).padStart(2, "0");
  const m = String(mins % 60).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Devuelve los horarios libres para una fecha dada, según la config del negocio
 * y los turnos ya ocupados ese día.
 */
export function getAvailableSlots(business, dateStr) {
  const date = new Date(dateStr + "T00:00:00");
  const dayKey = DAY_KEYS[date.getDay()];
  const hours = business.workingHours[dayKey];
  if (!hours) return []; // cerrado ese día

  const [openStr, closeStr] = hours;
  const open = toMinutes(openStr);
  const close = toMinutes(closeStr);
  const slot = business.slotMinutes;

  const taken = db
    .prepare(
      `SELECT time FROM appointments WHERE businessId = ? AND date = ? AND status = 'confirmed'`
    )
    .all(business.businessId, dateStr)
    .map((row) => row.time);

  const slots = [];
  for (let t = open; t + slot <= close; t += slot) {
    const hhmm = toHHMM(t);
    if (!taken.includes(hhmm)) slots.push(hhmm);
  }
  return slots;
}

export function createAppointment({ businessId, customerId, customerName, serviceId, date, time }) {
  const id = nanoid(8);
  db.prepare(
    `INSERT INTO appointments (id, businessId, customerId, customerName, serviceId, date, time)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, businessId, customerId, customerName, serviceId, date, time);
  return id;
}

export function cancelLastAppointment(businessId, customerId) {
  const row = db
    .prepare(
      `SELECT id FROM appointments WHERE businessId = ? AND customerId = ? AND status = 'confirmed'
       ORDER BY createdAt DESC LIMIT 1`
    )
    .get(businessId, customerId);
  if (!row) return false;
  db.prepare(`UPDATE appointments SET status = 'cancelled' WHERE id = ?`).run(row.id);
  return true;
}

export function listUpcomingAppointments(businessId) {
  return db
    .prepare(
      `SELECT * FROM appointments WHERE businessId = ? AND status = 'confirmed'
       ORDER BY date, time`
    )
    .all(businessId);
}
