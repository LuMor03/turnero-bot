import db from "../db/db.js";
import { getAvailableSlots, createAppointment, cancelLastAppointment } from "./scheduler.js";

// --- Helpers de estado guardado en SQLite ---

function getState(businessId, customerId) {
  const row = db
    .prepare(`SELECT step, data FROM conversation_state WHERE businessId = ? AND customerId = ?`)
    .get(businessId, customerId);
  if (!row) return { step: "start", data: {} };
  return { step: row.step, data: JSON.parse(row.data) };
}

function saveState(businessId, customerId, step, data) {
  db.prepare(
    `INSERT INTO conversation_state (customerId, businessId, step, data, updatedAt)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(customerId, businessId) DO UPDATE SET step=excluded.step, data=excluded.data, updatedAt=excluded.updatedAt`
  ).run(customerId, businessId, step, JSON.stringify(data));
}

function resetState(businessId, customerId) {
  db.prepare(`DELETE FROM conversation_state WHERE businessId = ? AND customerId = ?`).run(
    businessId,
    customerId
  );
}

// --- Utilidades de formato ---

function fillTemplate(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");
}

function listServicesText(business) {
  return business.services.map((s, i) => `${i + 1}. ${s.label}`).join("\n");
}

function nextNDates(n) {
  const dates = [];
  const today = new Date();
  for (let i = 0; dates.length < n && i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function formatDateHuman(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
}

/**
 * Procesa un mensaje entrante de un cliente y devuelve la respuesta del bot.
 * Es independiente del canal: tanto el chat web como WhatsApp llaman a esta misma función.
 */
export function processMessage(business, customerId, customerName, rawText) {
  const text = (rawText || "").trim();
  const lower = text.toLowerCase();
  const { step, data } = getState(business.businessId, customerId);

  // Atajos globales, funcionan en cualquier paso
  if (business.humanHandoffKeywords.some((k) => lower.includes(k))) {
    return "Te derivo con una persona del equipo, en breve te contactan por este mismo medio. 🙋";
  }
  if (business.cancelKeywords.some((k) => lower.includes(k))) {
    const cancelled = cancelLastAppointment(business.businessId, customerId);
    resetState(business.businessId, customerId);
    return cancelled
      ? "Listo, cancelé tu último turno. Si querés sacar otro, escribime 'turno'."
      : "No encontré ningún turno activo a tu nombre para cancelar.";
  }

  switch (step) {
    case "start": {
      saveState(business.businessId, customerId, "choose_service", {});
      return `${business.welcomeMessage}\n\n¿Qué servicio querés agendar?\n${listServicesText(business)}\n\nRespondé con el número.`;
    }

    case "choose_service": {
      const idx = parseInt(text, 10) - 1;
      const service = business.services[idx];
      if (!service) {
        return `No entendí. Respondé con el número del servicio:\n${listServicesText(business)}`;
      }
      const dates = nextNDates(5);
      const dateList = dates
        .map((d, i) => `${i + 1}. ${formatDateHuman(d)}`)
        .join("\n");
      saveState(business.businessId, customerId, "choose_date", {
        ...data,
        serviceId: service.id,
        serviceLabel: service.label,
        dateOptions: dates,
      });
      return `Elegiste: ${service.label}.\n\n¿Qué día te queda mejor?\n${dateList}\n\nRespondé con el número.`;
    }

    case "choose_date": {
      const idx = parseInt(text, 10) - 1;
      const chosenDate = data.dateOptions?.[idx];
      if (!chosenDate) {
        return "No entendí la fecha, respondé con el número de una de las opciones que te pasé.";
      }
      const slots = getAvailableSlots(business, chosenDate);
      if (slots.length === 0) {
        return `No quedan horarios libres ese día. Elegí otra fecha (número) o escribí 'turno' para volver a empezar.`;
      }
      const slotList = slots.map((s, i) => `${i + 1}. ${s}`).join("\n");
      saveState(business.businessId, customerId, "choose_time", {
        ...data,
        date: chosenDate,
        slotOptions: slots,
      });
      return `Horarios disponibles para el ${formatDateHuman(chosenDate)}:\n${slotList}\n\nRespondé con el número.`;
    }

    case "choose_time": {
      const idx = parseInt(text, 10) - 1;
      const chosenTime = data.slotOptions?.[idx];
      if (!chosenTime) {
        return "No entendí el horario, respondé con el número de una de las opciones.";
      }
      saveState(business.businessId, customerId, "ask_name", { ...data, time: chosenTime });
      return "Último paso: ¿a nombre de quién dejo el turno?";
    }

    case "ask_name": {
      const name = text || customerName || "Cliente";
      const id = createAppointment({
        businessId: business.businessId,
        customerId,
        customerName: name,
        serviceId: data.serviceId,
        date: data.date,
        time: data.time,
      });
      resetState(business.businessId, customerId);
      const confirmText = fillTemplate(business.confirmationMessage, {
        nombre: name,
        servicio: data.serviceLabel,
        fecha: formatDateHuman(data.date),
        hora: data.time,
      });
      return `${confirmText}\n\n(Turno #${id}. Si necesitás cancelarlo, escribime 'cancelar'.)`;
    }

    default: {
      resetState(business.businessId, customerId);
      return "Empecemos de nuevo. " + business.welcomeMessage;
    }
  }
}
