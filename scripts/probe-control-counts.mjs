/** Read-only collection counts for the control database. */
import mongoose from "mongoose";

const control = process.env.MONGODB_DB_NAME;
await mongoose.connect(process.env.MONGODB_URI, { dbName: control, serverSelectionTimeoutMS: 15000, autoIndex: false, autoCreate: false });
const entries = await mongoose.connection.db.listCollections({}, { nameOnly: false }).toArray();
for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
  if (entry.name.startsWith("system.")) continue;
  const count = entry.type === "collection" ? await mongoose.connection.db.collection(entry.name).estimatedDocumentCount() : "n/a";
  if (count === 0) continue;
  console.log(`${entry.type}\t${count}\t${entry.name}`);
}
await mongoose.disconnect();
