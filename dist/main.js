"use strict";
const textarea = document.getElementById("text-area");
const canvas = document.getElementById("result-canvas");
const resultTextArea = document.getElementById("result-text-area");
const imagePathInput = document.getElementById("image-path-input");
let isEmbed = false;
function EmbedChanged() {
    isEmbed = !isEmbed;
    imagePathInput.style.display = isEmbed ? "none" : "";
}
function StringToBytes(text) {
    const ret = [];
    for (let i = 0; i < text.length; ++i) {
        let charcode = text.charCodeAt(i);
        if (charcode < 0x80)
            ret.push(charcode);
        else if (charcode < 0x800) {
            ret.push(0xc0 | (charcode >> 6));
            ret.push(0x80 | (charcode & 0x3f));
        }
        else if (charcode < 0xd800 || charcode >= 0xe000) {
            ret.push(0xe0 | (charcode >> 12));
            ret.push(0x80 | ((charcode >> 6) & 0x3f));
            ret.push(0x80 | (charcode & 0x3f));
        }
        else {
            ++i;
            charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (text.charCodeAt(i) & 0x3ff));
            ret.push(0xf0 | (charcode >> 18));
            ret.push(0x80 | ((charcode >> 12) & 0x3f));
            ret.push(0x80 | ((charcode >> 6) & 0x3f));
            ret.push(0x80 | (charcode & 0x3f));
        }
    }
    return ret;
}
const ctx = canvas.getContext("2d");
function getRandomGenerator(seed) {
    // simple deterministic random generator to mix up bytes, so the image will look more random
    const imul = Math.imul;
    return function () {
        let t = seed += 0x6D2B79F5;
        t = imul(t ^ t >>> 15, t | 1);
        t ^= t + imul(t ^ t >>> 7, t | 61);
        return (t ^ t >>> 14) >>> 0;
    };
}
function GetRngSeed() {
    const seedStr = document.getElementById("rng-seed").value;
    if (seedStr === "")
        return Math.random() * 2147483648 | 0;
    else {
        const seed = Number(seedStr);
        if (isNaN(seed))
            return Math.random() * 2147483648 | 0;
        return seed;
    }
}
function Generate() {
    if (!isEmbed) {
        const imagePath = imagePathInput.value.trim();
        if (imagePath === "") {
            resultTextArea.value = "Image path must not be empty";
            return;
        }
        if (!imagePath.endsWith(".png")) {
            resultTextArea.value = "Image path must end with .png";
            return;
        }
    }
    if (textarea.value === "") {
        resultTextArea.value = "Input data is empty";
        return;
    }
    const seed = GetRngSeed();
    const rand = getRandomGenerator(seed);
    const inputBytes = StringToBytes(textarea.value);
    for (let i = 0; i < inputBytes.length; ++i) {
        inputBytes[i] = inputBytes[i] ^ (rand() & 0xff);
    }
    const headerBytes = [];
    let remainingLength = inputBytes.length;
    while (remainingLength !== 0) {
        let byte = remainingLength & 0x7f;
        remainingLength >>= 7;
        if (remainingLength !== 0)
            byte |= 0x80;
        headerBytes.push(byte);
    }
    if (generateMode === "hide") {
        GenerateAndHide(inputBytes, headerBytes, rand, seed);
        return;
    }
    const allPixelCount = Math.ceil((headerBytes.length + inputBytes.length) / 3);
    const pictureSize = Math.ceil(Math.sqrt(allPixelCount));
    canvas.width = pictureSize;
    canvas.height = pictureSize;
    const imageData = ctx.getImageData(0, 0, pictureSize, pictureSize);
    const data = imageData.data;
    let totalIndex = 0;
    function WriteByte(byte) {
        data[totalIndex++] = byte;
        if ((totalIndex & 3) === 3) {
            data[totalIndex] = 255;
            ++totalIndex;
        }
    }
    for (let i = 0; i < headerBytes.length; ++i)
        WriteByte(headerBytes[i]);
    for (let i = 0; i < inputBytes.length; ++i)
        WriteByte(inputBytes[i]);
    const maxIndex = pictureSize * pictureSize * 4;
    while (totalIndex < maxIndex)
        WriteByte(rand() & 0xff);
    ctx.putImageData(imageData, 0, 0);
    resultTextArea.value = GetLoadMinifiedString(seed, isEmbed ? canvas.toDataURL() : imagePathInput.value);
}
function LoadScriptFromImage(imgSrc, seed) {
    const img = new Image();
    img.onload = function () {
        const decodeCanvas = document.createElement("canvas");
        const decodeCtx = decodeCanvas.getContext("2d");
        decodeCanvas.width = img.width;
        decodeCanvas.height = img.height;
        decodeCtx.drawImage(img, 0, 0);
        const imageData = decodeCtx.getImageData(0, 0, img.width, img.height);
        const data = imageData.data;
        let totalIndex = 0;
        function ReadByte() {
            if ((totalIndex & 3) === 3)
                ++totalIndex;
            return data[totalIndex++];
        }
        let dataLength = 0;
        let shift = 0;
        while (true) {
            const byte = ReadByte();
            dataLength |= (byte & 0x7f) << shift;
            if ((byte & 0x80) !== 0)
                shift += 7;
            else
                break;
        }
        const rand = (function (seed) {
            const imul = Math.imul;
            return function () {
                let t = seed += 0x6D2B79F5;
                t = imul(t ^ t >>> 15, t | 1);
                t ^= t + imul(t ^ t >>> 7, t | 61);
                return (t ^ t >>> 14) >>> 0;
            };
        })(seed);
        const resultBytes = new Array(dataLength);
        for (let i = 0; i < dataLength; ++i) {
            resultBytes[i] = ReadByte() ^ (rand() & 0xff);
        }
        // String.fromCodePoint polyfill
        function StringFromCodePoint(codePoint) {
            if (codePoint < 0 || codePoint > 1114111 || codePoint !== Math.floor(codePoint))
                throw new Error("Invalid UTF-8 code point");
            if (codePoint < 65536)
                return String.fromCharCode(codePoint);
            else {
                codePoint -= 65536;
                return String.fromCharCode(codePoint >>> 10 & 1023 | 55296) + String.fromCharCode(codePoint & 1023 | 56320);
            }
        }
        function bytesToString(byteArray) {
            let ret = "";
            for (let i = 0; i < byteArray.length; ++i) {
                let charcode = byteArray[i];
                if (charcode >= 0x80) {
                    var bytecount = -1;
                    for (var j = 7; j >= 0; --j) {
                        if ((charcode >> j) & 1)
                            ++bytecount;
                        else
                            break;
                    }
                    if (i + bytecount >= byteArray.length)
                        throw new Error("Invalid UTF-8 byte sequence");
                    charcode &= (1 << (6 - bytecount)) - 1;
                    for (var j = 0; j < bytecount; ++j) {
                        charcode <<= 6;
                        var currentByte = byteArray[++i];
                        if ((currentByte & 0x80) != 0x80)
                            throw new Error("Invalid UTF-8 byte sequence");
                        charcode |= currentByte & 0x3f;
                    }
                }
                ret += StringFromCodePoint(charcode);
            }
            return ret;
        }
        eval(bytesToString(resultBytes));
    };
    img.src = imgSrc;
}
function GetLoadMinifiedString(seed, imageSrc) {
    // minified js version of LoadScriptFromImage, with error checks removed
    return `!function(q,r){var c=new Image;c.onload=function(){function p(){3===(l&3)&&++l;return t[l++]}var d=document.createElement("canvas"),e=d.getContext("2d");d.width=c.width;d.height=c.height;e.drawImage(c,0,0);var t=e.getImageData(0,0,c.width,c.height).data,l=0;for(e=d=0;;){var g=p();d|=(g&127)<<e;if(0!==(g&128))e+=7;else break}e=function(h){var k=Math.imul;return function(){var a=h+=1831565813;a=k(a^a>>>15,a|1);a^=a+k(a^a>>>7,a|61);return(a^a>>>14)>>>0}}(r);g=Array(d);for(var m=0;m<d;++m)g[m]=p()^e()&255;eval(function(h){for(var k="",a=0;a<h.length;++a){var b=h[a];if(128<=b){for(var n=-1,f=7;0<=f;--f)if(b>>f&1)++n;else break;b&=(1<<6-n)-1;for(f=0;f<n;++f){b<<=6;var u=h[++a];b|=u&63}}65536>b?b=String.fromCharCode(b):(b-=65536,b=String.fromCharCode(b>>>10&1023|55296)+String.fromCharCode(b&1023|56320));k+=b}return k}(g))};c.src=q}("${imageSrc}",${seed})`;
}
let generateMode = "random";
function ModeChanged(elem) {
    generateMode = elem.value;
    document.getElementById("image-selector").style.display = generateMode === "hide" ? "flex" : "none";
}
const offscreenCanvas = document.createElement("canvas");
const offscreenCtx = offscreenCanvas.getContext("2d");
let imageLoading = false;
let loadedImageData = null;
function FileSelected(elem) {
    const files = elem.files;
    if (!files)
        return;
    imageLoading = true;
    const fr = new FileReader();
    fr.onload = () => {
        const img = new Image();
        img.onload = () => {
            offscreenCanvas.width = img.width;
            offscreenCanvas.height = img.height;
            offscreenCtx.drawImage(img, 0, 0);
            loadedImageData = offscreenCtx.getImageData(0, 0, offscreenCanvas.width, offscreenCanvas.height).data;
            // remove transparent pixels
            for (let i = 0; i < loadedImageData.length; i += 4)
                loadedImageData[i + 3] = 255;
            imageLoading = false;
        };
        img.src = fr.result.toString();
    };
    fr.readAsDataURL(files[0]);
}
const bitCountText = document.getElementById("image-bitcount");
let imageBitcount = 1;
function ImageBitcountChanged(bitCount) {
    imageBitcount = bitCount;
    bitCountText.textContent = bitCount.toString();
}
function GenerateAndHide(inputBytes, headerBytes, rand, seed) {
    if (!loadedImageData) {
        resultTextArea.value = "No image selected";
        return;
    }
    const inputBitCount = (inputBytes.length + headerBytes.length) * 8;
    // 1 pixel is used to store bit count => total pixels = width * height - 1
    // 3xN bits per pixel
    const totalPixels = offscreenCanvas.width * offscreenCanvas.height;
    const availableBitsInTheImage = (totalPixels - 1) * 3 * imageBitcount;
    if (inputBitCount > availableBitsInTheImage) {
        resultTextArea.value = "Image is too small to contain the data:\nThe image can contain "
            + (availableBitsInTheImage / 8 | 0) + " bytes at max with the current settings, but "
            + (inputBytes.length + headerBytes.length + 1) + " bytes are needed.";
        return;
    }
    resultTextArea.value = "";
    const shouldFillImageWithRandomData = document.getElementById("fill-image-with-random-data-checkbox").checked;
    const newImageData = loadedImageData.slice();
    // write image bit count, only 1 bits per byte
    for (let i = 0; i < 3; ++i) {
        const bit = (((imageBitcount - 1) >>> i) & 1) !== 0;
        if (bit)
            newImageData[i] |= 1;
        else
            newImageData[i] &= ~1;
    }
    // start from byte 4
    let byteIndex = 4;
    let bitIndex = 0;
    function WriteBit(bit) {
        const mask = 1 << bitIndex;
        if (bit)
            newImageData[byteIndex] |= mask;
        else
            newImageData[byteIndex] &= ~mask;
        if (++bitIndex === imageBitcount) {
            ++byteIndex;
            bitIndex = 0;
            // skip alpha values
            if ((byteIndex & 3) === 3)
                ++byteIndex;
        }
    }
    function WriteByte(byte) {
        for (let i = 0; i < 8; ++i) {
            const bit = ((byte >>> i) & 1) !== 0;
            WriteBit(bit);
        }
    }
    for (let i = 0; i < headerBytes.length; ++i)
        WriteByte(headerBytes[i]);
    for (let i = 0; i < inputBytes.length; ++i)
        WriteByte(inputBytes[i]);
    if (shouldFillImageWithRandomData) {
        const totalBytes = totalPixels * 4;
        for (let i = bitIndex; i < imageBitcount; ++i)
            WriteBit((rand() & 1) !== 0);
        while (byteIndex < totalBytes)
            WriteBit((rand() & 1) !== 0);
    }
    canvas.width = offscreenCanvas.width;
    canvas.height = offscreenCanvas.height;
    ctx.putImageData(new ImageData(newImageData, offscreenCanvas.width, offscreenCanvas.height), 0, 0);
    resultTextArea.value = GetLoadHiddenMinifiedString((isEmbed ? canvas.toDataURL() : imagePathInput.value), seed);
}
function LoadFromHiddenImage(imgSrc, seed) {
    const img = new Image();
    img.onload = function () {
        const decodeCanvas = document.createElement("canvas");
        const decodeCtx = decodeCanvas.getContext("2d");
        decodeCanvas.width = img.width;
        decodeCanvas.height = img.height;
        decodeCtx.drawImage(img, 0, 0);
        const imageData = decodeCtx.getImageData(0, 0, img.width, img.height);
        const data = imageData.data;
        const bitCount = ((data[0] & 1) | ((data[1] & 1) << 1) | ((data[2] & 1) << 2)) + 1;
        let byteIndex = 4;
        let bitIndex = 0;
        function ReadBit() {
            const byte = data[byteIndex];
            const bit = (byte >> bitIndex) & 1;
            if (++bitIndex === bitCount) {
                ++byteIndex;
                bitIndex = 0;
                // skip alpha values
                if ((byteIndex & 3) === 3)
                    ++byteIndex;
            }
            return bit;
        }
        function ReadByte() {
            let byte = 0;
            for (let i = 0; i < 8; ++i)
                byte |= ReadBit() << i;
            return byte;
        }
        let dataLength = 0;
        let shift = 0;
        while (true) {
            const byte = ReadByte();
            dataLength |= (byte & 0x7f) << shift;
            if ((byte & 0x80) !== 0)
                shift += 7;
            else
                break;
        }
        const rand = (function (seed) {
            const imul = Math.imul;
            return function () {
                let t = seed += 0x6D2B79F5;
                t = imul(t ^ t >>> 15, t | 1);
                t ^= t + imul(t ^ t >>> 7, t | 61);
                return (t ^ t >>> 14) >>> 0;
            };
        })(seed);
        const resultBytes = new Array(dataLength);
        for (let i = 0; i < dataLength; ++i)
            resultBytes[i] = ReadByte() ^ (rand() & 0xff);
        // String.fromCodePoint polyfill
        function StringFromCodePoint(codePoint) {
            if (codePoint < 0 || codePoint > 1114111 || codePoint !== Math.floor(codePoint))
                throw new Error("Invalid UTF-8 code point");
            if (codePoint < 65536)
                return String.fromCharCode(codePoint);
            else {
                codePoint -= 65536;
                return String.fromCharCode(codePoint >>> 10 & 1023 | 55296) + String.fromCharCode(codePoint & 1023 | 56320);
            }
        }
        function bytesToString(byteArray) {
            let ret = "";
            for (let i = 0; i < byteArray.length; ++i) {
                let charcode = byteArray[i];
                if (charcode >= 0x80) {
                    var bytecount = -1;
                    for (var j = 7; j >= 0; --j) {
                        if ((charcode >> j) & 1)
                            ++bytecount;
                        else
                            break;
                    }
                    if (i + bytecount >= byteArray.length)
                        throw new Error("Invalid UTF-8 byte sequence");
                    charcode &= (1 << (6 - bytecount)) - 1;
                    for (var j = 0; j < bytecount; ++j) {
                        charcode <<= 6;
                        var currentByte = byteArray[++i];
                        if ((currentByte & 0x80) != 0x80)
                            throw new Error("Invalid UTF-8 byte sequence");
                        charcode |= currentByte & 0x3f;
                    }
                }
                ret += StringFromCodePoint(charcode);
            }
            return ret;
        }
        eval(bytesToString(resultBytes));
    };
    img.src = imgSrc;
}
function GetLoadHiddenMinifiedString(imgSrc, seed) {
    // minified js version of LoadFromHiddenImage, with error checks removed
    return `!function(t,u){var e=new Image;e.onload=function(){function r(){for(var d=0,c=0;8>c;++c){var a=k[l]>>n&1;++n===v&&(++l,n=0,3===(l&3)&&++l);d|=a<<c}return d}var f=document.createElement("canvas"),g=f.getContext("2d");f.width=e.width;f.height=e.height;g.drawImage(e,0,0);var k=g.getImageData(0,0,e.width,e.height).data,v=(k[0]&1|(k[1]&1)<<1|(k[2]&1)<<2)+1,l=4,n=0;for(g=f=0;;){var m=r();f|=(m&127)<<g;if(0!==(m&128))g+=7;else break}g=function(d){var c=Math.imul;return function(){var a=d+=1831565813;a=c(a^a>>>15,a|1);a^=a+c(a^a>>>7,a|61);return(a^a>>>14)>>>0}}(u);m=Array(f);for(var p=0;p<f;++p)m[p]=r()^g()&255;eval(function(d){for(var c="",a=0;a<d.length;++a){var b=d[a];if(128<=b){for(var q=-1,h=7;0<=h;--h)if(b>>h&1)++q;else break;b&=(1<<6-q)-1;for(h=0;h<q;++h){b<<=6;var w=d[++a];b|=w&63}}65536>b?b=String.fromCharCode(b):(b-=65536,b=String.fromCharCode(b>>>10&1023|55296)+String.fromCharCode(b&1023|56320));c+=b}return c}(m))};e.src=t}("${imgSrc}",${seed})`;
}
function CopyResult(button) {
    button.innerText = "Copied!";
    navigator.clipboard.writeText(resultTextArea.value);
}
