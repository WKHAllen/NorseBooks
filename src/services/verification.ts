import {
  mainDB,
  verifyTimeout,
  voidCallback,
  boolCallback,
  stringCallback,
  getTime,
  newHexId,
} from "./util";
import { MiscService } from "./misc";

// Database verification services
export module VerificationService {
  // Create a new email verification ID
  export function newVerifyId(email: string, callback?: stringCallback) {
    email = email.toLowerCase();
    var sql = `DELETE FROM Verify WHERE email = ?;`;
    var params = [email];
    mainDB.execute(sql, params, (rows) => {
      newHexId((verifyId) => {
        var sql = `SELECT id FROM Verify WHERE verifyId = ?;`;
        var params = [verifyId];
        mainDB.execute(sql, params, (rows) => {
          if (rows.length > 0) {
            newVerifyId(email, callback);
          } else {
            var sql = `INSERT INTO Verify (email, verifyId, createTimestamp) VALUES (?, ?, ?);`;
            var params = [email, verifyId, getTime()];
            mainDB.execute(sql, params, (rows) => {
              setTimeout(MiscService.pruneUnverified, verifyTimeout, verifyId);
              if (callback) callback(verifyId);
            });
          }
        });
      });
    });
  }

  // Check a verify ID
  export function checkVerifyId(verifyId: string, callback?: boolCallback) {
    var sql = `SELECT verifyId FROM Verify WHERE verifyId = ?;`;
    var params = [verifyId];
    mainDB.execute(sql, params, (rows) => {
      if (callback) callback(rows.length > 0);
    });
  }

  // Mark a user as verified
  export function setVerified(verifyId: string, callback?: voidCallback) {
    var sql = `
            UPDATE NBUser SET verified = 1 WHERE email = (
                SELECT email FROM Verify WHERE verifyId = ?
            );`;
    var params = [verifyId];
    mainDB.execute(sql, params, (rows) => {
      if (callback) callback();
    });
  }

  // Delete a verify ID
  export function deleteVerifyId(verifyId: string, callback?: voidCallback) {
    var sql = `DELETE FROM Verify WHERE verifyId = ?;`;
    var params = [verifyId];
    mainDB.execute(sql, params, (rows) => {
      if (callback) callback();
    });
  }
}
