// In-memory SSE bus — anonymous public broadcast.
// Every connected client gets every alert. Single-process Node only.

const clients = new Set(); // each entry: { res }

export function addClient(res) {
  const entry = { res };
  clients.add(entry);
  return () => clients.delete(entry);
}

export function publishAlert(scanner, alert) {
  const payload = `event: alert\ndata: ${JSON.stringify({ scanner_id: scanner.id, ...alert })}\n\n`;
  for (const entry of clients) {
    try {
      entry.res.write(payload);
    } catch (e) {
      // ignore broken pipe
    }
  }
}

export function clientCount() {
  return clients.size;
}
