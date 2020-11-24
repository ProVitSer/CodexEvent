'use strict';
const axios = require('axios'),
    util = require('util'),
    fs = require('fs'),
    FormData = require('form-data'),
    logger = require(`../logger/logger`),
    config = require(`../config/config`),
    moment = require('moment');

class Endpoint {
    constructor(urlSendEvent = config.endpoint.event, urlSendFile = config.endpoint.file) {
        this.urlSendEvent = urlSendEvent;
        this.urlSendFile = urlSendFile;
    }

    async sendEvent(...params) {
        logger.info(`Event данные  ${params}`);
        logger.info(params[0].CallId);
        let config = {
            headers: {
                'User-Agent': 'voipnotes/0.0.1',
                'Content-Type': 'application/json',
                //'Content-Length': json.length,
                //'Authorization': auth
            }
        }

        let json = {
            "CallId": params[0].CallId,
            "FromNumber": params[0].FromNumber,
            "ToNumber": params[0].ToNumber,
            "CodexExtention": params[0].CodexExtention,
            "Type": params[0].Type,
            "Status": params[0].Status,
            "Dtmf": params[0].Dtmf,
            "IncomingTime": params[0].IncomingTime,
            "AnswerTime": params[0].AnswerTime,
            "CallTime": params[0].CallTime,
            "EventTime": moment().format()

        }
        logger.info(`Отправляем запрос ${util.inspect(json)}`);

        try {
            const res = await axios.post(this.urlSendEvent, JSON.stringify(json), config)
            const result = await res;

            if (!result) {
                logger.info('Отсутствует результат');
            }
            logger.info(`Получили результат на запрос ${util.inspect(result.data)}`);
        } catch (e){
            logger.error(e);
        }

    };

    async sendAudio(audioFileName, uniqueid) {
        const formData = new FormData();
        let recordPath = moment().format("YYYY/MM/DD/");

        formData.append('recording', fs.createReadStream('/var/spool/asterisk/monitor/' + recordPath + audioFileName));
        formData.append('callId', uniqueid);

        let config = {
            method: 'post',
            url: this.urlSendFile,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            headers: {
                ...formData.getHeaders()
            },
            data: formData
        };

        try {
            const res = await axios(config)
            const result = await res;
            
            if (!result) {
                logger.error('Отсутствует результат');
            }
            logger.info(`Получили результат на запрос ${util.inspect(result.data)}`);

        } catch(e){
            logger.error(e);
        }

    };
};

module.exports = Endpoint;