import { createApp } from "./app.js";
import { openDatabase } from "./database.js";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const database = openDatabase();
const app = createApp({ database });

const server = app.listen(port, () => {
  console.log(`Pixel Print Lab disponibile su http://localhost:${port}`);
});

function shutdown() {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
