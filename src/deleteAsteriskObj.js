"use strict";

const delObj = (asteriskLinkedid, uniqueid) => {
    delete asteriskLinkedid[uniqueid];
};

module.exports = delObj;