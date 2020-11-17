"use strict";
const moment = require('moment'),
    util = require('util'),
    nami = require(`./models/ami`),
    Endpoint = require('./src/endpoints'),
    createAsteriskEventObj = require('./src/createAsteriskObj'),
    appConfig = require(`./config/config`),
    searchInDb = require('./src/searchInDb'),
    delObj = require('./deleteAsteriskObj');


const endpoint = new Endpoint(appConfig.endpoint.event),
    SEARCH_TIMEOUT = 15000,
    DEL_OBJ_TIMEOUT = 30000,
    CHECK_TIMEOUT = 500;

let asteriskLinkedid = [],
    check = true;

const checkCreateCallObj = () => {
    check = true;
};

const sendToEndpointIvrEvent = (linkedid) => {
    asteriskLinkedid[linkedid].Status = 'IVR';
    endpoint.sendEvent(asteriskLinkedid[linkedid]);
    logger.info(`Отправляем информация по IVR ${util.inspect(asteriskLinkedid[linkedid])}`);
};

//Обработка событий набора DTMF. Таймером setTimeout(checkDTMF, 500, event.linkedid); можно регулировать частоту попаданию DTMF в объект вызова
nami.on(`namiEventDTMFEnd`, (event) => {
    if (event.direction == `Received` &&
        event.calleridnum.toString().length > 3 &&
        event.context == 'ivr-1' &&
        event.exten == 's',
        asteriskLinkedid[event.linkedid].CheckDtmf
    ) {

        asteriskLinkedid[event.linkedid].CheckDtmf = false;
        if (asteriskLinkedid[event.linkedid].Dtmf == null) {
            asteriskLinkedid[event.linkedid].Timer = setTimeout(() => { sendToEndpointIvrEvent(event.linkedid) }, 5000);
        }
        asteriskLinkedid[event.linkedid].Dtmf = asteriskLinkedid[event.linkedid].Dtmf == null ? '' + event.digit : asteriskLinkedid[event.linkedid].Dtmf + event.digit;
        asteriskLinkedid[event.linkedid].switchCheckDtmf();
    }
});

nami.on(`namiEventNewexten`, (event) => {
    //Событие Входящий вызов. Создается уникальный объект на основе уникального идентификатора вызова Asterisk
    if (check && event.channelstatedesc == `Ring` &&
        event.calleridnum.toString().length > 3 &&
        event.context == 'from-pstn' &&
        event.appdata == '__DIRECTION=INBOUND') {

        logger.info(event);
        check = false;
        asteriskLinkedid[event.linkedid] = createAsteriskEventObj.createObj(event.linkedid, event.calleridnum, event.exten, null, "Incoming", "Inbound", null, moment().format(), null, null, moment().format());
        setTimeout(checkCreateCallObj, CHECK_TIMEOUT);
        endpoint.sendEvent(asteriskLinkedid[event.linkedid]);
        logger.info(`Создан объект ${util.inspect(asteriskLinkedid[event.linkedid])}`);
    }
    //Событие Начала обработки вызова. Событие не отправляется на endpoint, отладочная информация
    if (asteriskLinkedid[event.linkedid] &&
        asteriskLinkedid[event.linkedid].CheckEvent &&
        event.channelstatedesc == `Ringing` &&
        event.connectedlinenum.toString().length > 3 &&
        event.calleridnum.toString().length < 4 &&
        event.context == 'from-internal' &&
        event.application == 'AppDial' &&
        event.appdata == '(Outgoing Line)') {

        logger.info(event);
        asteriskLinkedid[event.linkedid].CheckEvent = false;
        asteriskLinkedid[event.linkedid].Status = 'Ringing';
        asteriskLinkedid[event.linkedid].switchCheckEvent();
    }
    //Событие Начала обработки вызова. Событие не отправляется на endpoint, отладочная информация
    if (event.channelstatedesc == `Ringing` &&
        event.connectedlinenum.toString().length < 4 &&
        event.calleridnum.toString().length > 4 &&
        event.context == 'from-pstn' &&
        event.application == 'AppDial' &&
        event.appdata == '(Outgoing Line)') {

        logger.info(event);
    }

    //Событие Congestion. Внутренний абонент не зарегистрирован
    if (event.channelstatedesc == `Up` &&
       event.calleridnum.toString().length > 3 &&
       event.exten == 's-CHANUNAVAIL' &&
       event.application == 'Congestion') {

       logger.info(event);
       asteriskLinkedid[event.linkedid].Status = 'Missed';
       setTimeout(searchInDb.searchCongestionCallInfoInCDR, SEARCH_TIMEOUT, asteriskLinkedid, event.linkedid);
       setTimeout(delObj, DEL_OBJ_TIMEOUT, asteriskLinkedid, event.linkedid);
   }

});

nami.on(`namiEventVarSet`, (event) => {
    if (event.calleridnum.toString().length < 4 &&
        event.connectedlinenum.toString().length > 3 &&
        event.context == 'from-internal' &&
        event.variable == 'BLINDTRANSFER') {

        logger.info(event);
        asteriskLinkedid[event.linkedid].CallTransfer = true;
    }
});

nami.on(`namiEventNewchannel`, (event) => {
    //Событие Исходящий вызов. Создается уникальный объект на основе уникального идентификатора вызова Asterisk
    if (check && event.channelstatedesc == `Ring` &&
        event.calleridnum.toString().length < 4 &&
        event.context == 'from-internal' &&
        event.exten.toString().length > 4) {

        logger.info(event);
        check = false;
        asteriskLinkedid[event.linkedid] = createAsteriskEventObj.createObj(event.linkedid, event.calleridnum, event.exten, event.calleridnum, "Outgoing", "Outbound", null, moment().format(), null, null, moment().format());
        setTimeout(checkCreateCallObj, CHECK_TIMEOUT);
        endpoint.sendEvent(asteriskLinkedid[event.linkedid]);
        logger.info(`Создан объект ${util.inspect(asteriskLinkedid[event.linkedid])}`);
    }
});

nami.on(`namiEventBridgeEnter`, (event) => {
    //Событие Поднятие трубки, начало разговора при входящем вызове напрямую на добавочный.
    if (asteriskLinkedid[event.linkedid] &&
        asteriskLinkedid[event.linkedid].CheckEvent &&
        event.bridgetechnology == `simple_bridge` &&
        event.connectedlinenum.toString().length > 3 &&
        event.calleridnum.toString().length < 4 &&
        event.context == 'from-internal') {

        logger.info(event);
        asteriskLinkedid[event.linkedid].CheckEvent = false;
        asteriskLinkedid[event.linkedid].CodexExtention = event.calleridnum;
        asteriskLinkedid[event.linkedid].Status = 'Answer';
        asteriskLinkedid[event.linkedid].AnswerTime = moment().format();
        asteriskLinkedid[event.linkedid].switchCheckEvent();
        endpoint.sendEvent(asteriskLinkedid[event.linkedid]);
    }
    //Событие Поднятие трубки, начало разговора при исходящем вызове.
    if (asteriskLinkedid[event.linkedid] &&
        asteriskLinkedid[event.linkedid].CheckEvent &&
        event.bridgetechnology == `simple_bridge` &&
        event.connectedlinenum.toString().length < 4 &&
        event.calleridnum.toString().length > 4 &&
        event.context == 'from-pstn') {

        logger.info(event);
        asteriskLinkedid[event.linkedid].CheckEvent = false;
        asteriskLinkedid[event.linkedid].Status = 'Answer';
        asteriskLinkedid[event.linkedid].AnswerTime = moment().format();
        asteriskLinkedid[event.linkedid].switchCheckEvent();
        endpoint.sendEvent(asteriskLinkedid[event.linkedid]);
    }
    //Событие Поднятие трубки, начало разговора при исходящем вызове в случае исходящий CID городской номер.
    if (asteriskLinkedid[event.linkedid] &&
        asteriskLinkedid[event.linkedid].CheckEvent &&
        event.bridgetechnology == `simple_bridge` &&
        event.connectedlinenum.toString().length > 4 &&
        event.calleridnum.toString().length > 4 &&
        event.context == 'from-pstn') {

        logger.info(event);
        asteriskLinkedid[event.linkedid].CheckEvent = false;
        asteriskLinkedid[event.linkedid].Status = 'Answer';
        asteriskLinkedid[event.linkedid].AnswerTime = moment().format();
        asteriskLinkedid[event.linkedid].switchCheckEvent();
        endpoint.sendEvent(asteriskLinkedid[event.linkedid]);
    }
    //Событие Поднятие трубки, начало разговора при входящем вызове напрямую при групповом вызове.
    if (asteriskLinkedid[event.linkedid] &&
        asteriskLinkedid[event.linkedid].CheckEvent &&
        event.bridgetechnology == `simple_bridge` &&
        event.connectedlinenum.toString().length > 3 &&
        event.calleridnum.toString().length < 4 &&
        event.context == 'macro-dial') {

        logger.info(event);
        asteriskLinkedid[event.linkedid].CheckEvent = false;
        asteriskLinkedid[event.linkedid].CodexExtention = event.calleridnum;
        asteriskLinkedid[event.linkedid].Status = 'Answer';
        asteriskLinkedid[event.linkedid].AnswerTime = moment().format();
        asteriskLinkedid[event.linkedid].switchCheckEvent();
        endpoint.sendEvent(asteriskLinkedid[event.linkedid]);
    }
});

nami.on(`namiEventHangup`, (event) => {
    //Событие Завершение входящего вызова. Групповой вызов отвеченный
    if (!asteriskLinkedid[event.linkedid].CallTransfer && 
        asteriskLinkedid[event.linkedid] &&
        asteriskLinkedid[event.linkedid].CheckEvent &&
        event.connectedlinenum.toString().length > 3 &&
        event.calleridnum.toString().length < 4 &&
        event.context == 'from-internal' &&
        event.channelstatedesc != 'Ringing') {

        logger.info(event);
        asteriskLinkedid[event.linkedid].CheckEvent = false;
        asteriskLinkedid[event.linkedid].CodexExtention = event.calleridnum;
        asteriskLinkedid[event.linkedid].Status = 'Completed';
        setTimeout(searchInDb.searchCallInfoInCdr, SEARCH_TIMEOUT, asteriskLinkedid, event.linkedid);
        setTimeout(delObj, DEL_OBJ_TIMEOUT, asteriskLinkedid, event.linkedid);
        asteriskLinkedid[event.linkedid].switchCheckEvent();
    }
    //Событие Завершение входящего вызова при трансфере.
    if (asteriskLinkedid[event.linkedid] &&
        asteriskLinkedid[event.linkedid].CallTransfer && 
        asteriskLinkedid[event.linkedid].CheckEvent &&
        event.connectedlinenum.toString().length < 4 &&
        event.calleridnum.toString().length > 4 &&
        event.context == 'from-internal' &&
        event.channelstatedesc != 'Ringing' &&
        event.cause != '26') {

        logger.info(event);
        asteriskLinkedid[event.linkedid].CheckEvent = false;
        asteriskLinkedid[event.linkedid].CodexExtention = event.connectedlinenum;
        asteriskLinkedid[event.linkedid].Status = 'Completed';
        setTimeout(searchInDb.searchTransferCallInfoInCDR, SEARCH_TIMEOUT, asteriskLinkedid, event.linkedid);
        setTimeout(delObj, DEL_OBJ_TIMEOUT, asteriskLinkedid, event.linkedid);
        asteriskLinkedid[event.linkedid].switchCheckEvent();
    }
    //Событие Завершение входящего вызова. Групповой вызов отвеченный
    if (asteriskLinkedid[event.linkedid] &&
        asteriskLinkedid[event.linkedid].CheckEvent &&
        event.connectedlinenum.toString().length < 4 &&
        event.calleridnum.toString().length > 4 &&
        event.context == 'ext-group' &&
        event.channelstatedesc != 'Ringing') {

        logger.info(event);
        asteriskLinkedid[event.linkedid].CheckEvent = false;
        asteriskLinkedid[event.linkedid].CodexExtention = event.connectedlinenum;
        asteriskLinkedid[event.linkedid].Status = 'Completed';
        setTimeout(searchInDb.searchCallInfoInCdr, SEARCH_TIMEOUT, asteriskLinkedid, event.linkedid);
        setTimeout(delObj, DEL_OBJ_TIMEOUT, asteriskLinkedid, event.linkedid);
        asteriskLinkedid[event.linkedid].switchCheckEvent();
    }
    //Событие Завершение входящего вызова. Групповой вызов неотвеченный
    if (asteriskLinkedid[event.linkedid] &&
        asteriskLinkedid[event.linkedid].CheckEvent &&
        event.connectedlinenum == '<unknown>' &&
        event.calleridnum.toString().length > 4 &&
        event.context == 'ext-group' &&
        event.channelstatedesc != 'Ringing') {

        logger.info(event);
        asteriskLinkedid[event.linkedid].CheckEvent = false;
        asteriskLinkedid[event.linkedid].Status = 'Completed';
        setTimeout(searchInDb.searchCallInfoInCdr, SEARCH_TIMEOUT, asteriskLinkedid, event.linkedid);
        setTimeout(delObj, DEL_OBJ_TIMEOUT, asteriskLinkedid, event.linkedid);
        asteriskLinkedid[event.linkedid].switchCheckEvent();
    }
    //Событие Завершение входящего вызова. Неответ или сброс вызова при звонке напрямую на добавочный номер
    if (asteriskLinkedid[event.linkedid] &&
        asteriskLinkedid[event.linkedid].CheckEvent &&
        event.connectedlinenum.toString().length > 3 &&
        event.calleridnum.toString().length < 4 &&
        event.context == 'from-internal' &&
        event.cause == '0' &&
        event.connectedlinename.replace(/(GC)(.*)/, `$1`) != 'GC') {

        logger.info(event);
        asteriskLinkedid[event.linkedid].CheckEvent = false;
        asteriskLinkedid[event.linkedid].CodexExtention = event.calleridnum;
        asteriskLinkedid[event.linkedid].Status = 'Completed';
        setTimeout(searchInDb.searchCallInfoInCdr, SEARCH_TIMEOUT, asteriskLinkedid, event.linkedid);
        setTimeout(delObj, DEL_OBJ_TIMEOUT, asteriskLinkedid, event.linkedid);
        asteriskLinkedid[event.linkedid].switchCheckEvent();
    }
    //Событие Завершение входящего вызова. Неответ или сброс вызова при звонке напрямую на добавочный номер
    if (asteriskLinkedid[event.linkedid] &&
        asteriskLinkedid[event.linkedid].CheckEvent &&
        event.connectedlinenum.toString().length > 3 &&
        event.calleridnum.toString().length < 4 &&
        event.context == 'from-internal' &&
        event.cause == '17' &&
        event.connectedlinename.replace(/(GC)(.*)/, `$1`) != 'GC') {

        logger.info(event);
        asteriskLinkedid[event.linkedid].CheckEvent = false;
        asteriskLinkedid[event.linkedid].CodexExtention = event.calleridnum;
        asteriskLinkedid[event.linkedid].Status = 'Completed';
        setTimeout(searchInDb.searchCallInfoInCdr, SEARCH_TIMEOUT, asteriskLinkedid, event.linkedid);
        setTimeout(delObj, DEL_OBJ_TIMEOUT, asteriskLinkedid, event.linkedid);
        asteriskLinkedid[event.linkedid].switchCheckEvent();
    }
    //Событие Завершение исходящего вызова.
    if (asteriskLinkedid[event.linkedid] &&
        asteriskLinkedid[event.linkedid].CheckEvent &&
        event.connectedlinenum.toString().length < 4 &&
        event.calleridnum.toString().length > 4 &&
        event.context == 'from-pstn') {

        logger.info(event);
        asteriskLinkedid[event.linkedid].CheckEvent = false;
        asteriskLinkedid[event.linkedid].Status = 'Completed';
        setTimeout(searchInDb.searchCallInfoInCdr, SEARCH_TIMEOUT, asteriskLinkedid, event.linkedid);
        setTimeout(delObj, DEL_OBJ_TIMEOUT, asteriskLinkedid, event.linkedid);
    }
    //Событие Завершение исходящего вызова в случае исходящий CID городской номер.
    if (asteriskLinkedid[event.linkedid] &&
        asteriskLinkedid[event.linkedid].CheckEvent &&
        event.connectedlinenum.toString().length > 4 &&
        event.calleridnum.toString().length > 4 &&
        event.context == 'from-pstn') {

        logger.info(event);
        asteriskLinkedid[event.linkedid].CheckEvent = false;
        asteriskLinkedid[event.linkedid].Status = 'Completed';
        setTimeout(searchInDb.searchCallInfoInCdr, SEARCH_TIMEOUT, asteriskLinkedid, event.linkedid);
        setTimeout(delObj, DEL_OBJ_TIMEOUT, asteriskLinkedid, event.linkedid);
    }
});