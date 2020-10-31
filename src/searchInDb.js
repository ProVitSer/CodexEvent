const db = require(`../models/db`),
    logger = require(`../logger/logger`),
    Endpoint = require('./endpoints'),
    util = require('util');

const endpoint = new Endpoint(appConfig.endpoint.event),
    endpointFile = new Endpoint(appConfig.endpoint.file);

const searchCallInfoInCdr = (asteriskLinkedid, uniqueid) => {
    db.query('select billsec,disposition,recordingfile from cdr where uniqueid like  "' + uniqueid + '"', (err, result) => {
        if (err) logger.error(err);
        if (result[0] && result.length == 1) {
            logger.info(`Результат выполнения запроса searchCallInfoInCdr ${util.inspect(result)}`);
            asteriskLinkedid[uniqueid].CallTime = result[0].billsec;
            asteriskLinkedid[uniqueid].Status = status[result[0].disposition];
            endpoint.sendEvent(asteriskLinkedid[uniqueid]);
            if (result[0].recordingfile && result[0].recordingfile != '') {
                logger.info(`Отправляем запись ${result[0].recordingfile}`);
                endpointFile.sendAudio(result[0].recordingfile, uniqueid);
            }
        } else if (result[0] && result.length == 2) {
            logger.info(`Результат выполнения запроса searchCallInfoInCdr ${util.inspect(result)}`);
            asteriskLinkedid[uniqueid].CallTime = result[0].billsec;
            asteriskLinkedid[uniqueid].Status = status[result[0].disposition];
            endpoint.sendEvent(asteriskLinkedid[uniqueid]);
            if (result[0].recordingfile && result[0].recordingfile != '') {
                logger.info(`Отправляем запись ${result[0].recordingfile}`);
                endpointFile.sendAudio(result[0].recordingfile, uniqueid);
            }
        } else {
            searchGroupCallInfoInCDR(asteriskLinkedid, uniqueid)
        }
    });
};

const searchGroupCallInfoInCDR = (asteriskLinkedid, uniqueid) => {
    db.query('select billsec,disposition,recordingfile from cdr where uniqueid like  "' + uniqueid + '" and disposition like "ANSWERED"', (err, result) => {
        if (err) logger.error(err);
        if (result[0]) {
            logger.info(`Результат выполнения запроса searchGroupCallInfoInCDR ${util.inspect(result)}`);
            asteriskLinkedid[uniqueid].CallTime = result[0].billsec;
            asteriskLinkedid[uniqueid].Status = status[result[0].disposition];
            endpoint.sendEvent(asteriskLinkedid[uniqueid]);
            if (result[0].recordingfile && result[0].recordingfile != '') {
                logger.info(`Отправляем запись ${result[0].recordingfile}`);
                endpointFile.sendAudio(result[0].recordingfile, uniqueid);
            }
        } else {
            logger.info(`Missed call ${uniqueid}`);
            asteriskLinkedid[uniqueid].Status = "Missed";
            endpoint.sendEvent(asteriskLinkedid[uniqueid]);
        }
    });
};


module.exports = searchCallInfoInCdr;