module.exports = {
    createObj: function(id, from, to, ext, type, status, dtmf, incominTime, answerTime, billsec, eventTime, timer) {
        const CHECK_EVENT_TIMEOUT = 10,
            CHECK_DTMF_TIMEOUT = 500;
        let obj = {
            "CallId": id,
            "FromNumber": from,
            "ToNumber": to,
            "CodexExtention": ext,
            "Type": type,
            "Status": status,
            "Dtmf": dtmf,
            "IncomingTime": incominTime,
            "AnswerTime": answerTime,
            "CallTime": billsec,
            "EventTime": eventTime,
            "CheckDtmf": true,
            "CheckEvent": true,
            "CallTransfer": false,
            "CallTransferId": '',
            "Timer": timer,
            switchCheckDtmf() {
                setTimeout(() => {
                    this.CheckDtmf = true;
                }, CHECK_DTMF_TIMEOUT);

            },
            switchCheckEvent() {
                setTimeout(() => {
                    this.CheckEvent = true;
                }, CHECK_EVENT_TIMEOUT);

            }
        }
        return obj;
    }
}