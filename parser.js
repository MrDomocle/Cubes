
// MARK: Plaintext
export function parsePlaintext(str) {
    let block = Array();
    let workStr = str.split("\n");
    let patStart = 0;

    let xMax = 0;
    let yMax = 0;
    // 1st pass: count comment offset and dimensions
    for (let line = 0; line < workStr.length; line++) {
        // ignore comments and count how many lines of them there are
        if (workStr[line].charAt(0) == "!") {
            patStart++;
            continue;
        }
        if (workStr[line].length > xMax) { xMax = workStr[line].length };
    }
    yMax = workStr.length-patStart;

    // 2nd pass: constuct array
    for (let y = 0; y < yMax; y++) {
        block.push(Array());
        for (let x = 0; x < xMax; x++) {
            block[y].push(workStr[y+patStart].charAt(x) == "O");
        }
    }

    return {block: block, x: xMax, y: yMax};
}
// MARK: rle
export function parseRleMeta(str) {
    
    let numbers = "0123456789";
    let xMax;
    let yMax;

    let nowParsing = "";
    let currNum = "";
    let rulestring = "";
    
    for (let c = 0; c < str.length; c++) {
        let char = str.charAt(c);
        // parse dimensions
        if (char == "x") {
            nowParsing = "x";
            currNum = "";
        }
        if (char == "y") {
            nowParsing = "y";
            currNum = "";
        }
        if (numbers.includes(char)) {
            currNum += char;
            if (nowParsing == "x") { xMax = parseInt(currNum) };
            if (nowParsing == "y") { yMax = parseInt(currNum) };
        }

        // parse rules
        if (char == "e") { // last character of "rule" in "rule = Bxx/Sxx"
            nowParsing = "wait rule";
            continue;
        }
        if (nowParsing == "wait rule") {
            if (char == "B" || numbers.includes(char)) {
                rulestring += char;
                nowParsing = "rule";
                continue;
            }
        }
        if (nowParsing == "rule") {
            rulestring += char;
        }
    }
    return [xMax, yMax, rulestring];
}
export function parseRle(str) {
    let block = Array();
    let workStr = str.split("\n");
    let patStart = 0;
    let numbers = "0123456789";
    
    // RLE parser working vars
    let runLength = 1;
    let mapX = 0;
    let mapY = 0;
    let parsingRunLength = "";
    let gotMeta = false;

    let xMax;
    let yMax;

    for (let line = 0; line < workStr.length; line++) {
        // ignore comments and count how many lines of them there are
        if (workStr[line].charAt(0) == "#") {
            continue;
        }

        // parse size and rule on the first line after comments
        if (!gotMeta) {
            let boundingBox = parseRleMeta(workStr[line]);
            gotMeta = true;
            xMax = boundingBox[0];
            yMax = boundingBox[1];
            block.push(Array());
            continue;
        }

        // parse actual pattern
        for (let c = 0; c < workStr[line].length; c++) {
            let char = workStr[line].charAt(c);
            if (char == "b") { // fill dead cell
                parsingRunLength = "";
                for (let i = 0; i < runLength; i++) {
                    block[mapY].push(false);
                }
                runLength = 1;
            } else if (char == "o") { // fill live cell
                parsingRunLength = "";
                for (let i = 0; i < runLength; i++) {
                    block[mapY].push(true);
                }
                runLength = 1;
            } else if (numbers.includes(char)) { // parse run length
                parsingRunLength += char;
                runLength = parseInt(parsingRunLength);
            } else if (char == "$") { // EOL
                // skip runLength lines
                for (let i = 0; i < runLength; i++) {
                    for (let j = block[mapY].length; j < xMax; j++) {
                        block[mapY].push(false);
                    }
                    // increment line counter and add new line to block
                    mapY++;
                    block.push(Array());
                }
                parsingRunLength = "";
                runLength = 1;
            } else if (char == "!") { // EOF
                for (let i = block[mapY].length; i < xMax; i++) { // end line
                    block[mapY].push(false);
                }
                mapY++;
                parsingRunLength = "";
                runLength = 1;
                break;
            }
        }
    }
    return {block: block, x: xMax, y: yMax};
}

export function getPatternType(str) {
    let c0 = str.charAt(0);
    if (c0 == "!" || c0 == "." || c0 == "O") { return "plaintext" };
    if (c0 == "#" || c0 == "x") { return "rle" };
    return "unknown"
}