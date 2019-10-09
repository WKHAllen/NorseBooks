const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('./db');

const dbURL = process.env.DATABASE_URL;
const saltRounds = 12;
const hexLength = 64;
const passwordResetTimeout = 60 * 60 * 1000;

var mainDB = new db.DB(dbURL);

function getTime() {
    return Math.floor(new Date().getTime() / 1000);
}

function init() {
    var userTable = `
        CREATE TABLE IF NOT EXISTS User (
            id SERIAL PRIMARY KEY,
            firstname TEXT NOT NULL,
            lastname TEXT NOT NULL,
            email TEXT NOT NULL,
            password TEXT NOT NULL,
            phone TEXT NOT NULL,
            imageUrl TEXT,
            joinTimestamp INT NOT NULL,
            lastLogin INT,
            itemsListed INT NOT NULL
        );
    `;
    var departmentTable = `
        CREATE TABLE IF NOT EXISTS Department (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL
        );
    `;
    var bookStateTable = `
        CREATE TABLE IF NOT EXISTS BookState (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL
        );
    `;
    var bookCourseTable = `
        CREATE TABLE IF NOT EXISTS BookCourse (
            bookId INT NOT NULL,
            courseNumber INT NOT NULL
        );
    `;
    var bookTable = `
        CREATE TABLE IF NOT EXISTS Book (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            departmentId INT NOT NULL,
            userId INT NOT NULL,
            price DOUBLE NOT NULL,
            condition TEXT NOT NULL,
            description TEXT,
            listedTimestamp INT NOT NULL,
            stateId INT NOT NULL
        );
    `;
    var passwordResetTable = `
        CREATE TABLE IF NOT EXISTS PasswordReset (
            id SERIAL PRIMARY KEY,
            email TEXT NOT NULL,
            resetId TEXT NOT NULL,
            createTimestamp INT NOT NULL
        );
    `;
    mainDB.executeMany([userTable, departmentTable, bookStateTable, bookCourseTable, bookTable, passwordResetTable]);
    var sql = `SELECT resetid, createtimestamp FROM passwordReset;`;
    mainDB.execute(sql, [], (err, rows) => {
        var timeRemaining;
        for (var row of rows) {
            timeRemaining = row.createTimestamp + Math.floor(passwordResetTimeout / 1000) - getTime();
            setTimeout(deletePasswordResetID, timeRemaining * 1000, row.resetid);
        }
    });
}

function deletePasswordResetID(passwordResetID, callback) {
    var sql = `DELETE FROM PasswordReset WHERE resetId = ?;`;
    var params = [passwordResetID];
    mainDB.execute(sql, params, (err, rows) => {
        if (callback) callback();
    });
}

module.exports = {
    'deletePasswordResetID': deletePasswordResetID
}

init();
