const fs = require('fs');
const path = require('path');

class BitWriter {
  constructor() {
    this.buffer = [];
    this.currentByte = 0;
    this.bitCount = 0;
  }

  writeBit(bit) {
    if (bit) {
      this.currentByte |= 1 << this.bitCount; // LSB first
    }
    this.bitCount++;
    if (this.bitCount === 8) {
      this.buffer.push(this.currentByte);
      this.currentByte = 0;
      this.bitCount = 0;
    }
  }

  writeBits(value, count) {
    for (let i = 0; i < count; i++) {
      // LSB first
      this.writeBit((value >> i) & 1);
    }
  }

  flush() {
    if (this.bitCount > 0) {
      this.buffer.push(this.currentByte);
      this.currentByte = 0;
      this.bitCount = 0;
    }
  }

  getBuffer() {
    this.flush();
    return Buffer.from(this.buffer);
  }
}

function reverseBits(n, bits) {
  let reversed = 0;
  for (let i = 0; i < bits; i++) {
    reversed = (reversed << 1) | (n & 1);
    n >>= 1;
  }
  return reversed;
}

const FIXED_LITERAL_LENGTH_CODES = {};

// 0-143: 8 bits, 00110000-10111111
for (let i = 0; i <= 143; i++) {
  FIXED_LITERAL_LENGTH_CODES[i] = {
    code: 0x30 + i,
    length: 8,
  };
}

// 144-255: 9 bits, 110010000-111111111
for (let i = 144; i <= 255; i++) {
  FIXED_LITERAL_LENGTH_CODES[i] = {
    code: 0x190 + (i - 144),
    length: 9,
  };
}

// 256-279: 7 bits, 0000000-0010111
for (let i = 256; i <= 279; i++) {
  FIXED_LITERAL_LENGTH_CODES[i] = {
    code: i - 256,
    length: 7,
  };
}

// Literals 280-287: 8 bits, codes 0xC0-0xC7
for (let i = 280; i <= 287; i++) {
  const code = 0xc0 + (i - 280); // 11000000 through 11000111
  FIXED_LITERAL_LENGTH_CODES[i] = {
    code: code,
    length: 8,
  };
}

const FIXED_DISTANCE_CODES = {};
for (let i = 0; i < 32; i++) {
  FIXED_DISTANCE_CODES[i] = {
    code: i,
    length: 5,
  };
}

class LZ77Compressor {
  constructor() {
    this.windowSize = 32768;
    this.minMatch = 3;
    this.maxMatch = 258;
  }

  compress(data) {
    if (!Buffer.isBuffer(data)) {
      throw new Error('Input phải là Buffer');
    }

    const output = [];
    let pos = 0;

    while (pos < data.length) {
      const match = this.findLongestMatch(data, pos);

      if (match) {
        output.push({
          type: 'match',
          distance: match.distance,
          length: match.length,
        });
        pos += match.length;
      } else {
        output.push({
          type: 'literal',
          value: data[pos],
        });
        pos++;
      }
    }

    output.push({ type: 'end' });
    console.log('[LZ77] Kết thúc nén');
    return output;
  }

  findLongestMatch(data, currentPos) {
    let maxLength = 0;
    let matchDistance = 0;
    const searchStart = Math.max(0, currentPos - this.windowSize);
    const maxSearchLength = Math.min(this.maxMatch, data.length - currentPos);

    for (let i = searchStart; i < currentPos; i++) {
      let matchLength = 0;
      while (
        matchLength < maxSearchLength &&
        data[i + matchLength] === data[currentPos + matchLength]
      ) {
        matchLength++;
      }
      if (matchLength >= this.minMatch && matchLength > maxLength) {
        maxLength = matchLength;
        matchDistance = currentPos - i;
      }
    }
    return maxLength >= this.minMatch ? { distance: matchDistance, length: maxLength } : null;
  }
}

class HuffmanEncoder {
  constructor() {
    this.literalLengthCodes = FIXED_LITERAL_LENGTH_CODES;
    this.distanceCodes = FIXED_DISTANCE_CODES;
  }

  encodeLiteral(literal) {
    return this.literalLengthCodes[literal];
  }

  encodeLength(length) {
    let code,
      extraBits = 0,
      numExtraBits = 0;

    if (length <= 10) {
      code = length + 254;
    } else if (length <= 18) {
      code = 265;
      extraBits = length - 11;
      numExtraBits = 1;
    } else if (length <= 34) {
      code = 266;
      extraBits = length - 19;
      numExtraBits = 2;
    } else if (length <= 66) {
      code = 267;
      extraBits = length - 35;
      numExtraBits = 3;
    } else if (length <= 130) {
      code = 268;
      extraBits = length - 67;
      numExtraBits = 4;
    } else if (length <= 257) {
      code = 269;
      extraBits = length - 131;
      numExtraBits = 5;
    } else {
      code = 270;
    }

    return {
      code,
      bitLength: this.literalLengthCodes[code].length,
      extraBits,
      numExtraBits,
    };
  }

  encodeDistance(distance) {
    let code = 0;
    let extraBits = 0;
    let numExtraBits = 0;

    if (distance <= 4) {
      code = distance - 1;
    } else if (distance <= 8) {
      code = 4;
      extraBits = distance - 5;
      numExtraBits = 1;
    } else if (distance <= 16) {
      code = 5;
      extraBits = distance - 9;
      numExtraBits = 2;
    } else if (distance <= 32) {
      code = 6;
      extraBits = distance - 17;
      numExtraBits = 3;
    } else if (distance <= 64) {
      code = 7;
      extraBits = distance - 33;
      numExtraBits = 4;
    } else if (distance <= 128) {
      code = 8;
      extraBits = distance - 65;
      numExtraBits = 5;
    } else if (distance <= 256) {
      code = 9;
      extraBits = distance - 129;
      numExtraBits = 6;
    } else if (distance <= 512) {
      code = 10;
      extraBits = distance - 257;
      numExtraBits = 7;
    } else if (distance <= 1024) {
      code = 11;
      extraBits = distance - 513;
      numExtraBits = 8;
    } else if (distance <= 2048) {
      code = 12;
      extraBits = distance - 1025;
      numExtraBits = 9;
    } else if (distance <= 4096) {
      code = 13;
      extraBits = distance - 2049;
      numExtraBits = 10;
    } else if (distance <= 8192) {
      code = 14;
      extraBits = distance - 4097;
      numExtraBits = 11;
    } else if (distance <= 16384) {
      code = 15;
      extraBits = distance - 8193;
      numExtraBits = 12;
    } else {
      code = 16;
      extraBits = distance - 16385;
      numExtraBits = 13;
    }

    return {
      code,
      bitLength: this.distanceCodes[code].length,
      extraBits,
      numExtraBits,
    };
  }
}

class DeflateCompressor {
  constructor(bitWriter) {
    this.lz77 = new LZ77Compressor();
    this.huffman = new HuffmanEncoder();
    this.bitWriter = bitWriter;
  }

  compress(input) {
    const symbols = this.lz77.compress(input);

    this.bitWriter.writeBits(0b110, 3); // LSB first 110 = 6

    for (const symbol of symbols) {
      if (symbol.type === 'literal') {
        const litCode = this.huffman.encodeLiteral(symbol.value);

        const code = this.reverseBits(litCode.code, litCode.length);
        this.bitWriter.writeBits(code, litCode.length);
      } else if (symbol.type === 'match') {
        // Length
        const lengthEncoded = this.huffman.encodeLength(symbol.length);
        this.bitWriter.writeBits(lengthEncoded.code, lengthEncoded.bitLength);
        if (lengthEncoded.numExtraBits > 0) {
          this.bitWriter.writeBits(lengthEncoded.extraBits, lengthEncoded.numExtraBits);
        }

        // Distance
        const distanceEncoded = this.huffman.encodeDistance(symbol.distance);
        this.bitWriter.writeBits(distanceEncoded.code, distanceEncoded.bitLength);
        if (distanceEncoded.numExtraBits > 0) {
          this.bitWriter.writeBits(distanceEncoded.extraBits, distanceEncoded.numExtraBits);
        }
      }
    }

    const endCode = this.huffman.encodeLiteral(256);
    this.bitWriter.writeBits(endCode.code, endCode.length);

    if (this.bitWriter.bitCount > 0) {
      const remainingBits = 8 - this.bitWriter.bitCount;
      this.bitWriter.writeBits(0, remainingBits);
    }

    return this.bitWriter.getBuffer();
  }

  reverseBits(value, length) {
    let result = 0;
    for (let i = 0; i < length; i++) {
      result = (result << 1) | ((value >> i) & 1);
    }
    return result;
  }
}
function calculateCRC32(data) {
  let crc = 0xffffffff;
  const table = new Int32Array(256);

  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xff];
  }

  return (crc ^ 0xffffffff) >>> 0;
}
function normalizeJsonData(data) {
  // const arrayData = Array.isArray(data) ? data : [data];

  // const normalizedData = arrayData.map((item) => {
  //   const normalizedItem = {};
  //   Object.keys(item)
  //     .sort()
  //     .forEach((key) => {
  //       normalizedItem[key] = item[key];
  //     });
  //   return normalizedItem;
  // });

  // return normalizedData;
  return data;
}

function createEndOfCentralDirectory(cdSize, cdOffset) {
  const eocd = Buffer.alloc(22);
  let offset = 0;

  eocd.writeUInt32LE(0x06054b50, offset);
  offset += 4;

  eocd.writeUInt16LE(0, offset);
  offset += 2;

  eocd.writeUInt16LE(0, offset);
  offset += 2;

  eocd.writeUInt16LE(1, offset);
  offset += 2;

  eocd.writeUInt16LE(1, offset);
  offset += 2;

  eocd.writeUInt32LE(cdSize, offset);
  offset += 4;

  eocd.writeUInt32LE(cdOffset, offset);
  offset += 4;

  eocd.writeUInt16LE(0, offset);

  return eocd;
}

function createZipFile(inputPath, outputPath) {
  console.log('[ZIP] Bắt đầu tạo file');
  const readStream = fs.createReadStream(inputPath);
  const writeStream = fs.createWriteStream(outputPath);
  let fileData = Buffer.alloc(0);

  readStream.on('data', (chunk) => {
    fileData = Buffer.concat([fileData, chunk]);
  });

  readStream.on('end', () => {
    try {
      console.log('[ZIP] Đọc xong dữ liệu đầu vào');
      const jsonData = JSON.parse(fileData.toString());
      const normalizedData = normalizeJsonData(jsonData);
      const jsonString = JSON.stringify(normalizedData);
      const finalBuffer = Buffer.from(jsonString, 'utf8');

      const crc32 = calculateCRC32(finalBuffer);
      console.log(`[ZIP] CRC32: ${crc32.toString(16)}`);

      const bitWriter = new BitWriter();
      const deflate = new DeflateCompressor(bitWriter);
      const compressedData = deflate.compress(finalBuffer);
      const filename = path.basename(inputPath);
      const originalSize = finalBuffer.length;
      const compressedSize = compressedData.length;

      // Track exact offsets
      let offset = 0;

      // Local header
      const localHeader = Buffer.alloc(30 + filename.length);
      localHeader.writeUInt32LE(0x04034b50, 0);
      localHeader.writeUInt16LE(20, 4);
      localHeader.writeUInt16LE(0, 6);
      localHeader.writeUInt16LE(8, 8);

      const now = new Date();
      const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
      const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

      localHeader.writeUInt16LE(time, 10);
      localHeader.writeUInt16LE(date, 12);
      localHeader.writeUInt32LE(crc32, 14);
      localHeader.writeUInt32LE(compressedSize, 18);
      localHeader.writeUInt32LE(originalSize, 22);
      localHeader.writeUInt16LE(filename.length, 26);
      localHeader.writeUInt16LE(0, 28);
      localHeader.write(filename, 30);

      writeStream.write(localHeader);
      offset += localHeader.length;

      writeStream.write(compressedData);
      offset += compressedSize;

      // Central directory with correct offset
      const cdHeader = Buffer.alloc(46 + filename.length);
      cdHeader.writeUInt32LE(0x02014b50, 0);
      cdHeader.writeUInt16LE(20, 4);
      cdHeader.writeUInt16LE(20, 6);
      cdHeader.writeUInt16LE(0, 8);
      cdHeader.writeUInt16LE(8, 10);
      cdHeader.writeUInt16LE(time, 12);
      cdHeader.writeUInt16LE(date, 14);
      cdHeader.writeUInt32LE(crc32, 16);
      cdHeader.writeUInt32LE(compressedSize, 20);
      cdHeader.writeUInt32LE(originalSize, 24);
      cdHeader.writeUInt16LE(filename.length, 28);
      cdHeader.writeUInt16LE(0, 30);
      cdHeader.writeUInt16LE(0, 32);
      cdHeader.writeUInt16LE(0, 34);
      cdHeader.writeUInt16LE(0, 36);
      cdHeader.writeUInt32LE(0, 38);
      cdHeader.writeUInt32LE(0, 42);
      cdHeader.write(filename, 46);

      const cdStart = offset;
      writeStream.write(cdHeader);
      const cdSize = cdHeader.length;

      // End of central directory
      const eocd = Buffer.alloc(22);
      eocd.writeUInt32LE(0x06054b50, 0);
      eocd.writeUInt16LE(0, 4);
      eocd.writeUInt16LE(0, 6);
      eocd.writeUInt16LE(1, 8);
      eocd.writeUInt16LE(1, 10);
      eocd.writeUInt32LE(cdSize, 12);
      eocd.writeUInt32LE(cdStart, 16);
      eocd.writeUInt16LE(0, 20);

      writeStream.write(eocd);
      writeStream.end();

      console.log('Compression complete:');
      console.log(`Original size: ${fileData.length} bytes`);
      console.log(`Compressed size: ${compressedData.length} bytes`);
      console.log(
        `Compression ratio: ${((1 - compressedData.length / fileData.length) * 100).toFixed(2)}%`
      );
    } catch (error) {
      console.error('Error:', error);
    }
  });
}

createZipFile('test.json', 'data.zip');
