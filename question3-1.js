const fs = require('fs');
const path = require('path');

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

function createZipFile(inputPath, outputPath) {
  try {
    const fileData = fs.readFileSync(inputPath);
    const filename = path.basename(inputPath);

    const compressedData = fileData;
    const crc32 = calculateCRC32(fileData);

    // Local file header
    const localHeader = Buffer.alloc(30 + filename.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // PK\x03\x04
    localHeader.writeUInt16LE(20, 4); // Version needed to extract
    localHeader.writeUInt16LE(0, 6); // General purpose bit flag
    localHeader.writeUInt16LE(0, 8); // Compression method (0 = stored)

    const now = new Date();
    const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

    localHeader.writeUInt16LE(time, 10);
    localHeader.writeUInt16LE(date, 12);
    localHeader.writeUInt32LE(crc32, 14);
    localHeader.writeUInt32LE(compressedData.length, 18);
    localHeader.writeUInt32LE(fileData.length, 22);
    localHeader.writeUInt16LE(filename.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localHeader.write(filename, 30);

    // Central directory header
    const cdHeader = Buffer.alloc(46 + filename.length);
    cdHeader.writeUInt32LE(0x02014b50, 0); // PK\x01\x02
    cdHeader.writeUInt16LE(20, 4);
    cdHeader.writeUInt16LE(20, 6);
    cdHeader.writeUInt16LE(0, 8);
    cdHeader.writeUInt16LE(0, 10);
    cdHeader.writeUInt16LE(time, 12);
    cdHeader.writeUInt16LE(date, 14);
    cdHeader.writeUInt32LE(crc32, 16);
    cdHeader.writeUInt32LE(compressedData.length, 20);
    cdHeader.writeUInt32LE(fileData.length, 24);
    cdHeader.writeUInt16LE(filename.length, 28);
    cdHeader.writeUInt16LE(0, 30);
    cdHeader.writeUInt16LE(0, 32);
    cdHeader.writeUInt16LE(0, 34);
    cdHeader.writeUInt16LE(0, 36);
    cdHeader.writeUInt32LE(0, 38);
    cdHeader.writeUInt32LE(0, 42);
    cdHeader.write(filename, 46);

    // End of central directory
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0); // PK\x05\x06
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(1, 8);
    eocd.writeUInt16LE(1, 10);
    eocd.writeUInt32LE(cdHeader.length, 12);
    eocd.writeUInt32LE(localHeader.length + compressedData.length, 16);
    eocd.writeUInt16LE(0, 20);

    // Ghi file
    const output = fs.createWriteStream(outputPath);
    output.write(localHeader);
    output.write(compressedData);
    output.write(cdHeader);
    output.write(eocd);
    output.end();

    console.log('Compression complete:');
    console.log(`Original size: ${fileData.length} bytes`);
    console.log(`Compressed size: ${compressedData.length} bytes`);
    console.log(
      `Compression ratio: ${((1 - compressedData.length / fileData.length) * 100).toFixed(2)}%`
    );
  } catch (error) {
    console.error('Error creating ZIP file:', error);
    throw error;
  }
}

createZipFile('data.json', 'test.zip');
