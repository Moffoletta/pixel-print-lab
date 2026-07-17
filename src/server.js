import { createApp } from "./app.js";
import { openDatabase } from "./database.js";
import { createEmailService } from "./email-service.js";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const database = openDatabase();
const emailService = createEmailService();
const app = createApp({
  database,
  uploadDirectory: process.env.UPLOAD_DIRECTORY,
  orderFileDirectory: process.env.ORDER_FILE_DIRECTORY,
  catalogDirectory: process.env.CATALOG_DIRECTORY,
  adminUsername: process.env.ADMIN_USERNAME,
  adminPassword: process.env.ADMIN_PASSWORD,
  emailService,
});

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
