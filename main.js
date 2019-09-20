
const textarea = document.getElementById("text-area");
const canvas = document.getElementById("result-canvas");

const resultTextArea = document.getElementById("result-text-area");
const imagePathInput = document.getElementById("image-path-input");

let isEmbed = false;
function EmbedChanged()
{
    isEmbed = !isEmbed;
    imagePathInput.style.display = isEmbed ? "none" : "";
}

function StringToBytes(text)
{
    var ret = [];
    for (var i = 0; i < text.length; ++i)
    {
        var charcode = text.charCodeAt(i);
        if (charcode < 0x80)
            ret.push(charcode);
        else if (charcode < 0x800)
        {
            ret.push(0xc0 | (charcode >> 6));
            ret.push(0x80 | (charcode & 0x3f));
        }
        else if (charcode < 0xd800 || charcode >= 0xe000)
        {
            ret.push(0xe0 | (charcode >> 12));
            ret.push(0x80 | ((charcode >> 6) & 0x3f));
            ret.push(0x80 | (charcode & 0x3f));
        }
        else
        {
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

function Generate()
{
    if (!isEmbed)
    {
        const imagePath = imagePathInput.value.trim();
        if (imagePath === "")
        {
            resultTextArea.value = "Image path must not be empty";
            return;
        }

        if (!imagePath.endsWith(".png"))
        {
            resultTextArea.value = "Image path must end with .png";
            return;
        }
    }

    // simple random generator to mix up bytes, so the image will look more random
    const seed = 0 | 1; // must be odd
    let state = 0;
    function GetDeterministicRandom()
    {
        const oldState = state;
        state = (state * 1947611761 + seed) >>> 0;
        const xorShifted = ((oldState >> 9) ^ oldState) >> 12;
        const rot = oldState >>> 28;
        return (((xorShifted >> rot) | (xorShifted << (16 - rot))) >>> 0) & 0xffff;
    }

    GetDeterministicRandom();
    GetDeterministicRandom();

    window.rand = GetDeterministicRandom;

    const inputBytes = StringToBytes(textarea.value);

    for (let i = 0; i < inputBytes.length; ++i)
    {
        inputBytes[i] = inputBytes[i] ^ (GetDeterministicRandom() & 0xff);
    }

    const headerBytes = [];
    let remainingLength = inputBytes.length;
    while (remainingLength !== 0)
    {
        let byte = remainingLength & 0x7f;
        remainingLength >>= 7;

        if (remainingLength !== 0)
            byte |= 0x80;

        headerBytes.push(byte);
    }

    const allPixelCount = Math.ceil((headerBytes.length + inputBytes.length) / 3);
    const pictureSize = Math.ceil(Math.sqrt(allPixelCount));

    canvas.width = pictureSize;
    canvas.height = pictureSize;

    const imageData = ctx.getImageData(0, 0, pictureSize, pictureSize);
    const data = imageData.data;

    let totalIndex = 0;
    function WriteByte(byte)
    {
        data[totalIndex++] = byte;

        if ((totalIndex & 3) === 3)
        {
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
        WriteByte((Math.random() * 256) | 0);

    ctx.putImageData(imageData, 0, 0);

    resultTextArea.value = loadMinified + "(\"" + (isEmbed ? canvas.toDataURL() : imagePathInput.value) + "\")";
}

function LoadScriptFromImage(imgSrc)
{
    const img = new Image();
    img.onload = function()
    {
        const decodeCanvas = document.createElement("canvas");
        const decodeCtx = decodeCanvas.getContext("2d");
        decodeCanvas.width = img.width;
        decodeCanvas.height = img.height;
        decodeCtx.drawImage(img, 0, 0);
        const imageData = decodeCtx.getImageData(0, 0, img.width, img.height);
        const data = imageData.data;

        let totalIndex = 0;
        function ReadByte()
        {
            if ((totalIndex & 3) === 3)
                ++totalIndex;

            return data[totalIndex++];
        }

        let dataLength = 0;
        let shift = 0;
        while (true)
        {
            const byte = ReadByte();
            dataLength |= (byte & 0x7f) << shift;

            if ((byte & 0x80) !== 0)
                shift += 7;
            else
                break;
        }

        const seed = 0 | 1; // must be odd
        let state = 0;
        function GetDeterministicRandom()
        {
            const oldState = state;
            state = (state * 1947611761 + seed) >>> 0;
            const xorShifted = ((oldState >> 9) ^ oldState) >> 12;
            const rot = oldState >>> 28;
            return (((xorShifted >> rot) | (xorShifted << (16 - rot))) >>> 0) & 0xffff;
        }

        GetDeterministicRandom();
        GetDeterministicRandom();

        const resultBytes = new Array(dataLength);
        for (let i = 0; i < dataLength; ++i)
        {
            resultBytes[i] = ReadByte() ^ GetDeterministicRandom();
        }

        // String.fromCodePoint polyfill
        function StringFromCodePoint()
        {
            let str = "";
            for (let i = 0; i < arguments.length; ++i)
            {
                let codePoint = Number(arguments[i]);
                if(codePoint < 0 || codePoint > 1114111 || codePoint !== Math.floor(codePoint))
                    return null;
                
                if (codePoint < 65536)
                    str += String.fromCharCode(codePoint);
                else
                {
                    codePoint -= 65536;
                    str += String.fromCharCode(codePoint >>> 10 & 1023 | 55296);
                    str += String.fromCharCode(codePoint & 1023 | 56320);
                }
            }

            return str;
        }

        function bytesToString(d){for(var f="",c=0;c<d.length;++c){var a=d[c];if(128<=a){for(var e=-1,b=7;0<=b;--b)if(a>>b&1)++e;else break;if(c+e>=d.length)return null;a&=(1<<6-e)-1;for(b=0;b<e;++b){a<<=6;var g=d[++c];if(128!=(g&128))return null;a|=g&63}}f+=StringFromCodePoint(a)}return f}

        eval(bytesToString(resultBytes));
    };

    img.src = imgSrc;
}

// minified version of LoadScriptFromImage

const loadMinified = `!function(u){var g=new Image,x=128;g.onload=function(){function r(){3===(n&3)&&++n;return v[n++]}function p(){var c=q;q=1947611761*q+1>>>0;var d=(c>>9^c)>>12;c>>>=28;return(d>>c|d<<16-c)>>>0&65535}function w(c){for(var d="",e=0;e<arguments.length;++e){var b=Number(arguments[e]);if(0>b||1114111<b||b!==Math.floor(b))return null;65536>b?d+=String.fromCharCode(b):(b-=65536,d+=String.fromCharCode(b>>>10&1023|55296),d+=String.fromCharCode(b&1023|56320))}return d}var h=document.createElement("canvas"),f=h.getContext("2d");h.width=g.width;h.height=g.height;f.drawImage(g,0,0);var v=f.getImageData(0,0,g.width,g.height).data,n=0;for(f=h=0;;){var k=r();h|=(k&127)<<f;if(0!==(k&x))f+=7;else break}var q=0;p();p();f=Array(h);for(k=0;k<h;++k)f[k]=r()^p();Function(function(c){for(var d="",e=0;e<c.length;++e){var b=c[e];if(x<=b){for(var m=-1,l=7;0<=l;--l)if(b>>l&1)++m;else break;if(e+m>=c.length)return null;b&=(1<<6-m)-1;for(l=0;l<m;++l){b<<=6;var t=c[++e];if(x!=(t&x))return null;b|=t&63}}d+=w(b)}return d}(f))()};g.src=u}`;