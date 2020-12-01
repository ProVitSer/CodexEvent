const db = require(`../models/db`),
    logger = require(`../logger/logger`),
    Endpoint = require('./endpoints'),
    util = require('util'),
    appConfig = require(`../config/config`);


const endpoint = new Endpoint(appConfig.endpoint.event),
    endpointFile = new Endpoint(appConfig.endpoint.file);

let status = {
    "NO ANSWER": "Missed",
    "ANSWERED": "Completed",
    "BUSY": "Busy"
};


const searchCallInfoInCdr = (asteriskLinkedid, uniqueid) => {
    logger.info(`Выполнение searchCallInfoInCdr ${asteriskLinkedid}  ${uniqueid}`);
    if (asteriskLinkedid[uniqueid].CallTransfer) { searchTransferCallInfoInCDR(asteriskLinkedid, uniqueid) } else {
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
    }
};

const searchGroupCallInfoInCDR = (asteriskLinkedid, uniqueid) => {
    logger.info(`Выполнение searchGroupCallInfoInCDR ${asteriskLinkedid}  ${uniqueid}`);
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


const searchCongestionCallInfoInCDR = (asteriskLinkedid, uniqueid) => {
    logger.info(`Выполнение searchCongestionCallInfoInCDR ${asteriskLinkedid}  ${uniqueid}`);
    db.query('select dst,recordingfile from cdr where uniqueid like  "' + uniqueid + '" ', (err, result) => {
        if (err) logger.error(err);
        if (result[0]) {
            logger.info(`Результат выполнения запроса searchCongestionCallInfoInCDR ${util.inspect(result)}`);
            asteriskLinkedid[uniqueid].CodexExtention = result[0].dst;
            endpoint.sendEvent(asteriskLinkedid[uniqueid]);
            if (result[0].recordingfile && result[0].recordingfile != '') {
                logger.info(`Отправляем запись ${result[0].recordingfile}`);
                endpointFile.sendAudio(result[0].recordingfile, uniqueid);
            }
        } else {
            logger.info(`Congestion call error ${uniqueid} ${util.inspect(result)}`);
        }
    });
};

const searchTransferCallInfoInCDR = (asteriskLinkedid, uniqueid) => {
    logger.info(`Выполнение searchTransferCallInfoInCDR ${asteriskLinkedid}  ${uniqueid}`);
    db.query('select dst,recordingfile,disposition, billsec from cdr where linkedid like "' + uniqueid + '" ORDER BY sequence DESC LIMIT 1;', (err, result) => {
        if (err) logger.error(err);
        if (result[0]) {
            logger.info(`Результат выполнения запроса searchTransferCallInfoInCDR ${util.inspect(result)}`);
            asteriskLinkedid[uniqueid].CodexExtention = result[0].dst;
            asteriskLinkedid[uniqueid].CallTime = result[0].billsec;
            asteriskLinkedid[uniqueid].Status = status[result[0].disposition];
            endpoint.sendEvent(asteriskLinkedid[uniqueid]);
            if (result[0].recordingfile && result[0].recordingfile != '') {
                logger.info(`Отправляем запись ${result[0].recordingfile}`);
                endpointFile.sendAudio(result[0].recordingfile, uniqueid);
            }
        } else {
            logger.info(`Transfer call error ${uniqueid} ${util.inspect(result)}`);
            //setTimeout(searchTransferCallInfoInCDR, 5000, '', uniqueid);
        }
    });
};



module.exports = { searchCallInfoInCdr, searchCongestionCallInfoInCDR, searchTransferCallInfoInCDR };