import { mainDB, boolCallback, stringCallback, rowsCallback } from "./util";

// Database book condition services
export module ConditionService {
  // Get all book conditions
  export function getConditions(callback?: rowsCallback) {
    var sql = `SELECT id, name FROM Condition ORDER BY id;`;
    mainDB.execute(sql, [], (rows) => {
      if (callback) callback(rows);
    });
  }

  // Get the name of a condition by ID
  export function getConditionName(
    conditionId: number,
    callback?: stringCallback
  ) {
    var sql = `SELECT name FROM Condition WHERE id = ?;`;
    var params = [conditionId];
    mainDB.execute(sql, params, (rows) => {
      if (callback) callback(rows[0].name);
    });
  }

  // Check if a book condition is valid
  export function validCondition(
    conditionId: number,
    callback?: boolCallback
  ) {
    var sql = `SELECT id FROM Condition WHERE id = ?;`;
    var params = [conditionId];
    mainDB.execute(sql, params, (rows) => {
      if (callback) callback(rows.length === 1);
    });
  }
}
