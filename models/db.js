"use strict";
const appConfig = require(`../config/config`),
    mysql = require(`mysql`),
    logger = require(`../logger/logger`);

const db = mysql.createConnection({
    host: appConfig.mysql.host,
    user: appConfig.mysql.username,
    password: appConfig.mysql.secret,
    database: appConfig.mysql.db
});

db.connect((err) => {
    if (err) {
        logger.error("Ошибка: " + err.message);
        return;
    }
    logger.info(`Подключение к серверу MySQL успешно установлено`);

});

module.exports = db;