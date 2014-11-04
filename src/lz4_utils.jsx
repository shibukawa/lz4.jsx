import "xxhash.jsx";

class Lz4Util {
    static const CHECKSUM_SEED : number = 0;

    static function descriptorChecksum(d : Uint8Array) : int {
	    return (ArrayBufferXXH.digest(d, Lz4Util.CHECKSUM_SEED) >> 8) & 0xFF;
    }

    static function streamChecksum(d : ArrayBuffer, checksum : ArrayBufferXXH) : ArrayBufferXXH {
        if (checksum == null) {
            checksum = new ArrayBufferXXH(Lz4Util.CHECKSUM_SEED);
        }
        return checksum.update(d);
    }

    static function streamChecksum(checksum : ArrayBufferXXH) : number {
        return checksum.digest();
    }

    static function blockChecksum(d : Uint8Array) : number {
	    return ArrayBufferXXH.digest(d, Lz4Util.CHECKSUM_SEED);
    }

    static function readInt32LE(buffer : Uint8Array, offset : int) : number {
        return (buffer[offset]) |
          (buffer[offset + 1] << 8) |
          (buffer[offset + 2] << 16) |
          (buffer[offset + 3] << 24);
    }
}

