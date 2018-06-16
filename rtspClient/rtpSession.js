/**
 * rtpSession
 * @class rtpSession
 */

function rtpSession() {
    "use strict";
    var BUFFER_SIZE = 1024 * 1024;
    var frameRate = 0;
    
    function Constructor() {
        this.rtpTimestampCbFunc = null;
        this.timeData = null;
    }

    Constructor.prototype = {
        setReturnCallback: function (RtpReturn) {
            this.rtpReturnCallback = RtpReturn;
        },
        depacketize: function (rtspinterleave, rtpheader, rtpPacketArray) { },
        SetTimeStamp: function (data) {
            this.timeData = data;
        },
        GetTimeStamp: function () {
            return this.timeData;
        },
        getRTPPacket: function (Channel, rtpPayload) { },
        ntohl: function (buffer) {
            return (((buffer[0] << 24) + (buffer[1] << 16) +
                (buffer[2] << 8) + buffer[3]) >>> 0);
        },
        appendBuffer: function (currentBuffer, newBuffer, readLength) {
            if ((readLength + newBuffer.length) >= currentBuffer.length) {
                var tmp = new Uint8Array(currentBuffer.length + BUFFER_SIZE);
                tmp.set(currentBuffer, 0);
                currentBuffer = tmp;
            }
            currentBuffer.set(newBuffer, readLength);
            return currentBuffer;
        },
        setFramerate: function (_framerate) {
            frameRate = _framerate;
        },
        getFramerate: function () {
            return frameRate;
        },
        close: function () {

        }
    };
    return new Constructor();
}
