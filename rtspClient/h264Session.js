/**
 * h264Session
 * @class h264Session
 */
var h264Session = function () {
    'use strict';
    var rtpTimeStamp = 0;
    var inputLength = 0;
    var size_1M = 1024 * 1024;
    var isPlayback = false;
    var inputBuffer = new Uint8Array(size_1M);
    var PREFIX = new Uint8Array([0x00, 0x00, 0x00, 0x01]);
    var timeData = {
        'timestamp': null,
        'timestamp_usec': null,
        'timezone': null
    };

    var sps_segment = null;
    var pps_segment = null;

    var setBuffer = function (buffer1, buffer2) {
        if ((inputLength + buffer2.length) > buffer1.length) {
            buffer1 = new Uint8Array(buffer1.length + size_1M);
        }

        buffer1.set(buffer2, inputLength);
        inputLength += buffer2.length;
        return buffer1;
    };

    var inheritObject = function (base, properties) {
        var keyList = Object.keys(properties);
        for (var i = 0; i < keyList.length; i++) {
            base[keyList[i]] = properties[keyList[i]];
        }
        return base;
    }

    function Constructor() { }

    Constructor.prototype = inheritObject(new RtpSession(), {
        init: function () {
            isPlayback = false;
        },
        depacketize: function (rtspInterleaved, rtpHeader, rtpPayload) {
            var HEADER = rtpHeader;
            var PAYLOAD;
            var extensionHeaderLen = 0;
            var PaddingSize = 0;

            if ((rtpHeader[0] & 0x20) === 0x20) {
                PaddingSize = rtpPayload[rtpPayload.length - 1];
                console.log("H264Session::PaddingSize - " + PaddingSize);
            }

            //Exist extension header
            if ((rtpHeader[0] & 0x10) === 0x10) {
                extensionHeaderLen = ((rtpPayload[2] << 8 | rtpPayload[3]) * 4) + 4;

                if (rtpPayload[0] == '0xAB' && rtpPayload[1] == '0xAD') {
                    var startHeader = 4,
                        NTPmsw = new Uint8Array(4),
                        NTPlsw = new Uint8Array(4),
                        gmt = new Uint8Array(4),
                        fsynctime = {
                            'seconds': null,
                            'useconds': null
                        },
                        microseconds;

                    NTPmsw.set(rtpPayload.subarray(startHeader, startHeader + 4), 0);
                    startHeader += 4;
                    NTPlsw.set(rtpPayload.subarray(startHeader, startHeader + 4), 0);
                    startHeader += 6;
                    gmt.set(rtpPayload.subarray(startHeader, startHeader + 2), 0);

                    microseconds = (this.ntohl(NTPlsw) / 0xffffffff) * 1000;
                    fsynctime.seconds = ((this.ntohl(NTPmsw) - 0x83AA7E80) >>> 0);
                    fsynctime.useconds = microseconds;
                    gmt = (((gmt[0] << 8) | gmt[1]) << 16) >> 16;
                    NTPmsw = null;
                    NTPlsw = null;
                    timeData = {
                        timestamp: fsynctime.seconds,
                        timestamp_usec: fsynctime.useconds,
                        timezone: gmt
                    };

                    if ((this.getFramerate() === 0 || this.getFramerate() === undefined) && 
                        (this.GetTimeStamp() != null || this.GetTimeStamp() !== undefined)) {
                        this.setFramerate(Math.round(1000 / (((timeData.timestamp - this.GetTimeStamp().timestamp) == 0 ? 0 : 1000) + (timeData.timestamp_usec - this.GetTimeStamp().timestamp_usec))));
                    }
                    this.SetTimeStamp(timeData);
                    isPlayback = true;
                } else {
                    isPlayback = false;
                }
            }

            PAYLOAD = rtpPayload.subarray(extensionHeaderLen, rtpPayload.length - PaddingSize);
            rtpTimeStamp = this.ntohl(rtpHeader.subarray(4, 8));

            var nal_type = (PAYLOAD[0] & 0x1f);
            if (nal_type === 0) {
                console.info("H264Session::error nal_type = " + nal_type);
            }
            switch (nal_type) {
                default: 
                    inputBuffer = setBuffer(inputBuffer, PREFIX);
                    inputBuffer = setBuffer(inputBuffer, PAYLOAD);
                    break;
                case 28:    // Fragmentation unit(FU)
                    var start_bit = ((PAYLOAD[1] & 0x80) === 0x80),
                        end_bit = ((PAYLOAD[1] & 0x40) === 0x40),
                        fu_type = PAYLOAD[1] & 0x1f,
                        payload_start_index = 2;
                    if (start_bit == true && end_bit == false) {
                        var new_nal_header = new Uint8Array(1);
                        new_nal_header[0] = (PAYLOAD[0] & 0x60 | fu_type);
                        inputBuffer = setBuffer(inputBuffer, PREFIX);
                        inputBuffer = setBuffer(inputBuffer, new_nal_header);
                        inputBuffer = setBuffer(inputBuffer, PAYLOAD.subarray(payload_start_index, PAYLOAD.length));
                    } else {
                        inputBuffer = setBuffer(inputBuffer, PAYLOAD.subarray(payload_start_index, PAYLOAD.length));
                    }
                    break;
                case 7:     //SPS
                    inputBuffer = setBuffer(inputBuffer, PREFIX);
                    inputBuffer = setBuffer(inputBuffer, PAYLOAD);
                    sps_segment = PAYLOAD;
                    break;
                case 8:     //PPS
                    inputBuffer = setBuffer(inputBuffer, PREFIX);
                    inputBuffer = setBuffer(inputBuffer, PAYLOAD);
                    pps_segment = PAYLOAD;
                    break;
                case 6:     //SEI
                    break;
            }

            //check marker bit, End of frame
            if ((HEADER[1] & 0x80) == 0x80) {
                var inputBufferSub = inputBuffer.subarray(0, inputLength);
                var frameType = '';
                inputLength = 0;

                if ((inputBufferSub[4] & 0x1f) === 0x07) {
                    frameType = 'I';
                } else {
                    frameType = 'P';
                }
                var streamData = {
                    'codecType': 'H264',
                    'frameData': inputBufferSub,
                    'timeStamp': {
                        'rtpTimestamp': (rtpTimeStamp / 90).toFixed(0),
                        'timestamp': timeData.timestamp,
                        'timestamp_usec': timeData.timestamp_usec,
                        'timezone': timeData.timezone
                    }
                }
                var videoInfo = {
                    'frameType': frameType,
                    'spsPayload': sps_segment,
                    'ppsPayload': pps_segment,
                    'framerate': this.getFramerate()
                }

                this.rtpReturnCallback(isPlayback, streamData, videoInfo);
                return;
            }
        }
    });

    return new Constructor();
};

