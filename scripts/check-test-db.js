require("dotenv").config();
const uri = process.env.MONGODB_TEST_URI;
const resetAllowed = String(process.env.ALLOW_TEST_DB_RESET || "").toLowerCase() === "true";
if (!uri) {
  console.error("Set MONGODB_TEST_URI to a dedicated test database before running API integration tests.");
  process.exit(1);
}
const databaseName = (uri.split("?")[0].split("/").pop() || "").trim();
if (!/test/i.test(databaseName)) {
  console.error("Refusing to run API tests: the database name must contain 'test' because the test suite clears it.");
  process.exit(1);
}
if (!resetAllowed) {
  console.error("Set ALLOW_TEST_DB_RESET=true only after confirming MONGODB_TEST_URI points to a disposable test database.");
  process.exit(1);
}
