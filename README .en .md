**Leé esto en [Español](README.md).**

Turnero Bot

A chat-based appointment booking bot — configurable per business and channel-agnostic. A business (hair salon, medical office, gym) defines its setup in a single config file and gets an assistant that books appointments with its customers through a WhatsApp-style conversation.

Mostrar imagen Mostrar imagen Mostrar imagen Mostrar imagen

Status: Working MVP. The conversation engine is complete and tested end-to-end; the WhatsApp connector is the next step (see Roadmap).

The problem

Many small businesses handle bookings by hand over WhatsApp: the customer messages, someone has to reply, check the calendar, offer time slots, and write it down. It's slow, it interrupts the actual work, and it's error-prone (double-booked slots, forgotten appointments). This bot automates that entire conversation.

Demo

Mostrar imagen

The project includes a web chat interface that mimics WhatsApp, so the whole flow can be tested without relying on Meta's API.

Try it
bash
npm install
npm start

Open http://localhost:3000 and chat with the bot as if it were WhatsApp. Use the selector in the top-right to switch between the sample businesses (hair salon / medical office) and see how the same engine behaves differently just by swapping the config file.

Keywords the bot understands at any point in the conversation (kept in Spanish, since they're the literal words a customer types):

turno → starts the booking flow
cancelar → cancels the last confirmed appointment
hablar con alguien → hands off to a human
How it works

Each conversation is a state machine. The bot walks the customer through ordered steps —choose service → choose day → choose time → give name → confirm— and on every incoming message it:

Loads which step that customer is on (state is stored in SQLite, so it survives between messages).
Validates the answer; if it's invalid, it asks again.
Saves the choice and advances to the next step.
Returns the bot's next message.

Core design decision: the engine knows nothing about WhatsApp. The processMessage(business, customerId, name, text) function takes text and returns text — nothing else. The channel (web chat today, WhatsApp tomorrow) is swappable without touching the logic. This makes it possible to build and test the entire flow from day one, without waiting on phone-number verification in Meta, which can take days.

Structure
turnero-bot/
├── server.js                   # Express server, exposes /api/chat
├── config/businesses/          # one .json per business = the bot's configuration
├── src/engine/
│   ├── conversationEngine.js   # the state machine: what it asks and in what order
│   └── scheduler.js            # computes free slots, saves and cancels appointments
├── src/db/db.js                # SQLite persistence (Node's native module)
└── public/index.html           # in-browser test chat (mimics WhatsApp)
Adding a new business

No code required: copy a file in config/businesses/, give it a unique businessId, and adjust:

services — services offered and their duration in minutes
workingHours — hours per day (null = closed that day)
slotMinutes — how often an appointment can be booked
the copy (welcomeMessage, confirmationMessage)

That separation between data (config) and logic (engine) is what makes it possible to onboard a new client in minutes.

Stack
Node.js + Express — server and HTTP endpoint
SQLite (Node's native module) — persistence without a separate database server
Vanilla HTML / CSS / JS — test interface
Roadmap
 WhatsApp connector via the WhatsApp Cloud API (Meta): a webhook that receives incoming messages and calls processMessage(...), with the server deployed on Railway or Render.
 Owner dashboard — a web view listing the day's / week's appointments.
 Automated reminders — a message the day before the appointment to reduce no-shows.
 Flexible date/time parsing — understand "tomorrow at 4", not just the option number.
