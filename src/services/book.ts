import { mainDB, voidCallback, boolCallback, numberCallback, stringCallback, rowCallback, rowsCallback, getTime, newBase64Id } from './util';
import { MetaService } from './meta';
import { SearchSortService } from './searchSort';

// Database book services
export module BookService {

    // Create a new book id
    export function newBookId(callback?: stringCallback, length?: number) {
        newBase64Id((bookId) => {
            var sql = `SELECT id FROM Book WHERE bookId = ?;`;
            var params = [bookId];
            mainDB.execute(sql, params, (rows) => {
                if (rows.length > 0) {
                    newBookId(callback, length);
                } else {
                    if (callback) callback(bookId);
                }
            });
        }, length);
    }

    // Add a new book
    export function newBook(title: string, author: string, departmentId: number, courseNumber: number, conditionId: number, description: string, userId: number, price: number, imageUrl: string, ISBN10: string, ISBN13: string, callback?: stringCallback) {
        newBookId((bookId) => {
            var sql = `
                INSERT INTO Book (
                    bookId, title, author, departmentId, courseNumber, conditionId, description, userId, price, listedTimestamp, imageUrl, ISBN10, ISBN13
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;
            var params = [bookId, title, author, departmentId, courseNumber, conditionId, description, userId, price, getTime(), imageUrl, ISBN10, ISBN13];
            mainDB.execute(sql, params, (rows) => {
                if (callback) callback(bookId);
                var sql = `UPDATE NBUser SET itemsListed = itemsListed + 1 WHERE id = ?;`;
                var params = [userId];
                mainDB.execute(sql, params);
            });
        });
    }

    // Edit an existing book
    export function editBook(bookId: string, title: string, author: string, departmentId: number, courseNumber: number, conditionId: number, description: string, userId: number, price: number, imageUrl: string, ISBN10: string, ISBN13: string, callback?: voidCallback) {
        var params = [title, author, departmentId, courseNumber, conditionId, description, price, ISBN10, ISBN13];
        var image = '';
        if (imageUrl !== null) {
            image = ', imageUrl = ?';
            params.push(imageUrl);
        }
        params.push(bookId, userId);
        var sql = `
            UPDATE Book
                SET title = ?, author = ?, departmentId = ?, courseNumber = ?, conditionId = ?,
                description = ?, price = ?, ISBN10 = ?, ISBN13 = ?${image}
            WHERE bookId = ? AND userId = ?;`;
        mainDB.execute(sql, params, (rows) => {
            if (callback) callback();
        });
    }

    // Check if a book is valid
    export function validBook(bookId: string, callback?: boolCallback) {
        var sql = `SELECT id FROM Book WHERE bookId = ?;`;
        var params = [bookId];
        mainDB.execute(sql, params, (rows) => {
            if (callback) callback(rows.length === 1);
        });
    }

    // Get information on a book
    export function getBookInfo(bookId: string, callback?: rowCallback) {
        var sql = `SELECT id, title, author, departmentId, courseNumber, conditionId, description, price, imageUrl, ISBN10, ISBN13 FROM Book WHERE bookId = ?;`;
        var params = [bookId];
        mainDB.execute(sql, params, (rows) => {
            if (callback) callback(rows[0]);
        });
    }

    // Get information on the user who listed a book
    export function getUserBookInfo(bookId: string, callback?: rowCallback) {
        var sql = `
            SELECT id, userId, firstname, lastname, contactPlatformId, contactInfo FROM NBUser WHERE id = (
                SELECT userId FROM Book WHERE bookId = ?
            );`;
        var params = [bookId];
        mainDB.execute(sql, params, (rows) => {
            if (callback) callback(rows[0]);
        });
    }

    // Get the number of departments
    export function getNumUserBooks(userId: number, callback?: numberCallback) {
        var sql = `SELECT id FROM Book WHERE userId = ?;`;
        var params = [userId];
        mainDB.execute(sql, params, (rows) => {
            if (callback) callback(rows.length);
        });
    }

    // Delete a book
    export function deleteBook(userId: number, bookId: string, callback?: voidCallback) {
        var sql = `DELETE FROM Book WHERE id = ? AND userId = ?;`;
        var params = [bookId, userId];
        mainDB.execute(sql, params, (rows) => {
            var sql = `DELETE FROM Report WHERE bookId = ?;`;
            var params = [bookId];
            mainDB.execute(sql, params, (rows) => {
                if (callback) callback();
            });
        });
    }

    // Delete a book and mark it as sold
    export function bookSold(userId: number, bookId: string, callback?: voidCallback) {
        var sql = `UPDATE NBUser SET itemsSold = itemsSold + 1 WHERE id = ?;`;
        var params = [userId];
        mainDB.execute(sql, params, (rows) => {
            var sql = `
                UPDATE NBUser SET moneyMade = moneyMade + (
                    SELECT price FROM Book WHERE id = ?
                ) WHERE id = ?;`;
            var params = [bookId, userId];
            mainDB.execute(sql, params, (rows) => {
                deleteBook(userId, bookId, () => {
                    if (callback) callback();
                });
            });
        });
    }

    // Get info on books searched
    export function searchBooks(options: object, sort: number, lastBookId: string, callback?: rowsCallback) {
        var params = [];
        var extraParams = [];
        var searchQuery = '';
        if (Object.keys(options).length > 0) {
            var searchOptions = [];
            for (var option in options) {
                if (option === 'title' || option === 'author') {
                    searchOptions.push(` LOWER(${option}) LIKE LOWER(?)`);
                    params.push(`%${options[option]}%`);
                    if (lastBookId) extraParams.push(`%${options[option]}%`);
                } else if (option === 'ISBN') {
                    searchOptions.push(' (ISBN10 = ? OR ISBN13 = ?)');
                    params.push(options[option], options[option]);
                    if (lastBookId) {
                        extraParams.push(options[option], options[option]);
                    }
                } else {
                    searchOptions.push(` ${option} = ?`);
                    params.push(options[option]);
                    if (lastBookId) extraParams.push(options[option]);
                }
            }
            for (var extraParam of extraParams) params.push(extraParam);
            searchQuery = ' WHERE' + searchOptions.join(' AND');
        }
        SearchSortService.getSearchSortQuery(sort, (sortQuery) => {
            MetaService.getMeta('Books per query', (booksPerQuery) => {
                var numBooksPerQuery = parseInt(booksPerQuery);
                sortQuery = sortQuery || 'listedTimestamp DESC';
                if (lastBookId) {
                    var sql = `
                        SELECT * FROM (
                            SELECT
                                bookId, title, author, departmentId, Department.name AS department, courseNumber,
                                price, conditionId, ISBN10, ISBN13,
                                ROW_NUMBER () OVER (ORDER BY ${sortQuery}) AS index
                            FROM Book
                            JOIN Department ON Book.departmentId = Department.id
                            ${searchQuery}
                        ) search1 WHERE index > (
                            SELECT index FROM (
                                SELECT
                                    bookId, title, author, departmentId, Department.name AS department, courseNumber,
                                    price, conditionId, ISBN10, ISBN13,
                                    ROW_NUMBER () OVER (ORDER BY ${sortQuery}) AS index
                                FROM Book
                                JOIN Department ON Book.departmentId = Department.id
                                ${searchQuery}
                            ) search2 WHERE bookId = ?
                        ) LIMIT ?;`;
                    params.push(lastBookId, numBooksPerQuery);
                } else {
                    var sql = `
                        SELECT
                            bookId, title, author, departmentId, Department.name AS department, courseNumber,
                            price, conditionId, ISBN10, ISBN13,
                            ROW_NUMBER () OVER (ORDER BY ${sortQuery}) AS index
                        FROM Book
                        JOIN Department ON Book.departmentId = Department.id
                        ${searchQuery} LIMIT ?;`;
                    params.push(numBooksPerQuery);
                }
                mainDB.execute(sql, params, (rows) => {
                    if (callback) callback(rows);
                });
            });
        });
    }

    // Get the id of the person who listed a book
    export function bookLister(bookId: string, callback?: numberCallback) {
        var sql = `SELECT userId FROM Book WHERE id = ?;`;
        var params = [bookId];
        mainDB.execute(sql, params, (rows) => {
            if (callback) callback(rows[0].userid);
        });
    }

}
