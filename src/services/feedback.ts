import {
  mainDB,
  feedbackTimeout,
  voidCallback,
  boolCallback,
  getTime,
} from "./util";

// Database feedback services
export module FeedbackService {
  // Check if a user can provide feedback
  export function canProvideFeedback(userId: number, callback?: boolCallback) {
    var sql = `SELECT id FROM NBUser WHERE id = ? AND (lastFeedbackTimestamp < ? OR lastFeedbackTimestamp IS NULL);`;
    var params = [userId, getTime() - Math.floor(feedbackTimeout / 1000)];
    mainDB.execute(sql, params, (rows) => {
      if (callback) callback(rows.length === 1);
    });
  }

  // Update a user's feedback timestamp to the current time
  export function updateFeedbackTimestamp(
    userId: number,
    callback?: voidCallback
  ) {
    var sql = `UPDATE NBUser SET lastFeedbackTimestamp = ? WHERE id = ?;`;
    var params = [getTime(), userId];
    mainDB.execute(sql, params, (rows) => {
      if (callback) callback();
    });
  }
}
