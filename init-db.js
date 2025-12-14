import pkg from "pg";
const { Client } = pkg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function initDB() {
  try {
    await client.connect();

    console.log("✅ Connected to PostgreSQL");

    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        description TEXT,
        image TEXT,
        category_id INTEGER REFERENCES categories(id)
      );
    `);

    await client.query(`
      INSERT INTO categories (name)
      VALUES ('Одежда')
      ON CONFLICT (name) DO NOTHING;
    `);

    await client.query(`
      INSERT INTO products (name, price, description)
      SELECT 'Titan Test Product', 9990, 'Автосид при деплое'
      WHERE NOT EXISTS (
        SELECT 1 FROM products WHERE name = 'Titan Test Product'
      );
    `);

    console.log("✅ DB initialized successfully");
  } catch (err) {
    console.error("❌ DB init error:", err);
  }
}
