const fs = require('fs');
const path = require('path');
const csv = require('fast-csv');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('./db');

const dbURL = process.env.DATABASE_URL;
const saltRounds = 12;
const hexLength = 64;
const passwordResetTimeout = 60 * 60 * 1000;
const staticTablePath = 'tables';

var mainDB = new db.DB(dbURL);

function getTime() {
    return Math.floor(new Date().getTime() / 1000);
}

function getStaticTablePath(tableName) {
    return path.join(__dirname, staticTablePath, tableName) + '.csv';
}

function populateStaticTable(tableName) {
    var sql;
    var params;
    fs.createReadStream(getStaticTablePath(tableName))
        .pipe(csv.parse({ headers: true }))
        .on('data', (row) => {
            sql = `INSERT INTO ${tableName} (id, name) VALUES (?, ?);`;
            params = [tableName, row.id, row.name];
            mainDB.execute(sql, params);
        });
}

function init() {
    // Drop static tables
    var dropDepartmentTable = `
        DROP TABLE IF EXISTS Department;
    `;
    var dropBookStateTable = `
        DROP TABLE IF EXISTS BookState;
    `;
    mainDB.executeMany([dropDepartmentTable, dropBookStateTable]);
    // Create tables
    var userTable = `
        CREATE TABLE IF NOT EXISTS NBUser (
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
        CREATE TABLE Department (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL
        );
    `;
    var bookStateTable = `
        CREATE TABLE BookState (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL
        );
    `;
    var bookTable = `
        CREATE TABLE IF NOT EXISTS Book (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            departmentId INT NOT NULL,
            userId INT NOT NULL,
            price NUMERIC(5,2) NOT NULL,
            condition TEXT NOT NULL,
            description TEXT,
            listedTimestamp INT NOT NULL,
            stateId INT NOT NULL
        );
    `;
    var bookCourseTable = `
        CREATE TABLE IF NOT EXISTS BookCourse (
            bookId INT NOT NULL,
            courseNumber INT NOT NULL
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
    mainDB.executeMany([userTable, departmentTable, bookStateTable, bookTable, bookCourseTable, passwordResetTable]);
    // Populate static tables
    populateStaticTable('BookState');
    populateStaticTable('Department');
    // Remove expired password resets
    var sql = `SELECT resetId, createTimestamp FROM PasswordReset;`;
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
