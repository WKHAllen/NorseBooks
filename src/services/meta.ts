import { mainDB, voidCallback, stringCallback } from "./util";

// Database metadata services
export module MetaService {
  // Get the value of a variable in the Meta table
  export function getMeta(key: string, callback?: stringCallback) {
    var sql = `SELECT value FROM Meta WHERE key = ?;`;
    var params = [key];
    mainDB.execute(sql, params, (rows) => {
      if (callback) callback(rows[0].value);
    });
  }

  // Set the value of a variable in the Meta table
  export function setMeta(key: string, value: any, callback?: voidCallback) {
    var sql = `UPDATE Meta SET value = ? WHERE key = ?;`;
    var params = [value, key];
    mainDB.execute(sql, params, (rows) => {
      if (callback) callback();
    });
  }
}
