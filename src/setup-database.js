import { openDatabase, seedDatabase } from "./database.js";

const database = openDatabase();

try {
  seedDatabase(database);
  const productCount = database.prepare("SELECT COUNT(*) AS count FROM products").get().count;
  const colorCount = database.prepare("SELECT COUNT(*) AS count FROM colors").get().count;
  console.log(`Database pronto: ${productCount} prodotti, ${colorCount} colori.`);
} finally {
  database.close();
}
