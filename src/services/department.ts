import { mainDB, boolCallback, stringCallback, rowsCallback } from "./util";

// Database department services
export module DepartmentService {
  // Get all departments
  export function getDepartments(callback?: rowsCallback) {
    var sql = `SELECT id, name FROM Department ORDER BY name;`;
    mainDB.execute(sql, [], (rows) => {
      rows.push({ id: -1, name: "Other" });
      if (callback) callback(rows);
    });
  }

  // Get the name of a department by ID
  export function getDepartmentName(
    departmentId: number,
    callback?: stringCallback
  ) {
    if (departmentId === -1) {
      if (callback) callback("Other");
    } else {
      var sql = `SELECT name FROM Department WHERE id = ?;`;
      var params = [departmentId];
      mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows[0].name);
      });
    }
  }

  // Check if a department is valid
  export function validDepartment(
    departmentId: number,
    callback?: boolCallback
  ) {
    if (departmentId === -1) {
      if (callback) callback(true);
    } else {
      var sql = `SELECT id FROM Department WHERE id = ?;`;
      var params = [departmentId];
      mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows.length === 1);
      });
    }
  }
}
