import psycopg2
import os
import pathlib
import json
import decimal
from datetime import datetime
from parseEnv import parseEnv

# Get the project root path
def getRootPath():
    thisPath = str(pathlib.Path(__file__).parent.absolute())
    rootPath = os.path.split(thisPath)[0]
    return rootPath

# Get the path of the .env file
def getEnvPath():
    rootPath = getRootPath()
    envPath = os.path.join(rootPath, ".env")
    return envPath

# Get the path to the backups directory
def getBackupPath():
    rootPath = getRootPath()
    backupPath = os.path.join(rootPath, "backups")
    return backupPath

# Get a database backup path
def getDBBackupPath(backupDir):
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    dbFile = f"norsebooks.backup.{timestamp}.json"
    dbPath = os.path.join(backupDir, dbFile)
    return dbPath

# Get the list of tables in the database
def getTables(db):
    sql = "SELECT table_name AS table FROM information_schema.tables WHERE table_schema = 'public';"
    db.execute(sql)
    tables = [row[0] for row in db.fetchall()]
    return tables

# Get a table's column names
def getTableColumns(db, table):
    sql = f"SELECT column_name AS column FROM information_schema.columns WHERE table_name = '{table}';"
    db.execute(sql)
    columns = [row[0] for row in db.fetchall()]
    return columns

# Get all data in a table
def getTableData(db, table, columns):
    if "id" not in columns:
        sql = f"SELECT * FROM {table};"
    else:
        sql = f"SELECT * FROM {table} ORDER BY id ASC;"
    db.execute(sql)
    tableData = db.fetchall()
    return tableData

# Convert Decimal objects to strings
def fixDecimalValues(tableData):
    fixedData = []

    for row in tableData:
        fixedRow = []

        for value in row:
            if type(value) != decimal.Decimal:
                fixedRow.append(value)
            else:
                fixedRow.append(str(value))

        fixedData.append(tuple(fixedRow))

    return fixedData

# Save the database backup
def saveBackup(dbPath, dbData):
    with open(dbPath, "w") as f:
        json.dump(dbData, f, indent=2)

# Perform the backup
def backup(db, backupDir):
    dbPath = getDBBackupPath(backupDir)
    dbData = {}

    tables = getTables(db)
    for table in tables:
        tableColumns = getTableColumns(db, table)
        tableData = getTableData(db, table, tableColumns)
        
        dbData[table] = {}
        dbData[table]["columns"] = tableColumns
        dbData[table]["data"] = fixDecimalValues(tableData)

    saveBackup(dbPath, dbData)

    return dbPath

# Back up the database
def backupDB(dbUrl, backupDir):
    conn = psycopg2.connect(dbUrl, sslmode="require")
    cur = conn.cursor()

    os.makedirs(backupDir, exist_ok=True)

    dbPath = backup(cur, backupDir)

    cur.close()
    conn.close()

    return dbPath

# Execute the backup script
def main():
    print("Backing up database...")

    envFile = getEnvPath()
    env = parseEnv(envFile)
    dbUrl = env["DATABASE_URL"]
    backupPath = getBackupPath()

    dbPath = backupDB(dbUrl, backupPath)

    print(f"Database has been backed up to {dbPath}")

if __name__ == "__main__":
    main()
