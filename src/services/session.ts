import {
  mainDB,
  sessionTimeout,
  voidCallback,
  stringCallback,
  getTime,
  newHexId,
} from "./util";

// Database session services
export module SessionService {
  // Create a new session ID
  export function newSessionId(email: string, callback?: stringCallback) {
    email = email.toLowerCase();
    var sql = `
            DELETE FROM Session WHERE userId = (
                SELECT id FROM NBUser WHERE email = ?
            );`;
    var params = [email];
    mainDB.execute(sql, params, (rows) => {
      newHexId((sessionId) => {
        var sql = `SELECT id FROM Session WHERE id = ?;`;
        var params = [sessionId];
        mainDB.execute(sql, params, (rows) => {
          if (rows.length > 0) {
            newSessionId(email, callback);
          } else {
            var sql = `
                            INSERT INTO Session (id, userId, createTimestamp) VALUES (
                                ?,
                                (SELECT id FROM NBUser WHERE email = ?),
                                ?
                            );`;
            var params = [sessionId, email, getTime()];
            mainDB.execute(sql, params, (rows) => {
              setTimeout(deleteSession, sessionTimeout, sessionId);
              if (callback) callback(sessionId);
            });
          }
        });
      });
    });
  }

  // Delete a session
  export function deleteSession(sessionId: string, callback?: voidCallback) {
    var sql = `DELETE FROM Session WHERE id = ?;`;
    var params = [sessionId];
    mainDB.execute(sql, params, (rows) => {
      if (callback) callback();
    });
  }
}
