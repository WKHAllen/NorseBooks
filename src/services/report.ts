import {
  mainDB,
  reportTimeout,
  boolCallback,
  numberCallback,
  getTime,
  voidCallback,
} from "./util";
import { BookService } from "./book";
import { MetaService } from "./meta";

// Database book reporting services
export module ReportService {
  // Report a book
  export function reportBook(
    userId: number,
    bookId: string,
    callback?: boolCallback
  ) {
    var sql = `INSERT INTO Report (bookId, userId, reportTimestamp) VALUES (?, ?, ?);`;
    var params = [bookId, userId, getTime()];
    mainDB.execute(sql, params, (rows) => {
      numBookReports(bookId, (reports) => {
        BookService.bookLister(bookId, (listerId) => {
          MetaService.getMeta("Max reports", (maxReports) => {
            var numMaxReports = parseInt(maxReports);
            if (reports >= numMaxReports) {
              BookService.deleteBook(listerId, bookId);
              if (callback) callback(true);
            } else {
              if (callback) callback(false);
            }
          });
        });
      });
    });
  }

  // Unreport a book
  export function unreportBook(
    userId: number,
    bookId: string,
    callback?: voidCallback
  ) {
    var sql = `DELETE FROM Report WHERE userId = ? AND bookId = ?`;
    var params = [userId, bookId];
    mainDB.execute(sql, params, (rows) => {
      if (callback) callback();
    });
  }

  // Check if a user has already reported a book
  export function userReportedBook(
    userId: number,
    bookId: string,
    callback?: boolCallback
  ) {
    var sql = `SELECT id FROM Report WHERE bookId = ? AND userId = ?;`;
    var params = [bookId, userId];
    mainDB.execute(sql, params, (rows) => {
      if (callback) callback(rows.length > 0);
    });
  }

  // Check if a user has reported a book recently
  export function userReportedRecently(
    userId: number,
    callback?: boolCallback
  ) {
    var sql = `SELECT id FROM Report WHERE userId = ? AND reportTimestamp > ?;`;
    var params = [userId, getTime() - Math.floor(reportTimeout / 1000)];
    mainDB.execute(sql, params, (rows) => {
      if (callback) callback(rows.length > 0);
    });
  }

  // Get the number of reports on a book
  export function numBookReports(bookId: string, callback?: numberCallback) {
    var sql = `SELECT id FROM Report WHERE bookId = ?;`;
    var params = [bookId];
    mainDB.execute(sql, params, (rows) => {
      if (callback) callback(rows.length);
    });
  }
}
