try {
  const Database = require("better-sqlite3");
  const db = new Database(":memory:");
  db.exec("create table t (x int); insert into t values (1)");
  console.log("better-sqlite3 OK", db.prepare("select count(*) c from t").get());
} catch (e) {
  console.log("better-sqlite3 ERR", e.message);
}
