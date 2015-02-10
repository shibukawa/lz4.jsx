import "lz4_static.jsx";
import "lz4_utils.jsx";
import "xxhash.jsx";
import "console.jsx";

class Lz4Descriptor {
    var blockIndependence : boolean;
    var blockChecksum : boolean;
    var blockMaxSize : int;
    var streamSize : boolean;
    var streamChecksum : boolean;
    var dict : boolean;
    var dictId : int;
}

native class _Memcpy {
    static function memcpy(buffer : Uint8Array, dstIndex : int, srcIndex : int, length : int) : void;
} = '''(function () {
    if (Uint8Array.prototype.copyWithin) {
        return {
            memcpy: function (buffer, dstIndex, srcIndex, length) {
                if (srcIndex > dstIndex) {
                    var endIndex = srcIndex + length;
                    while (srcIndex < endIndex) {
                        buffer[dstIndex++] = buffer[srcIndex++];
                    }
                } else {
                    buffer.copyWithin(dstIndex, srcIndex, length);
                }
            }
        };
    } else {
        return {
            memcpy: function (buffer, dstIndex, srcIndex, length) {
                var endIndex = srcIndex + length;
                while (srcIndex < endIndex) {
                    buffer[dstIndex++] = buffer[srcIndex++];
                }
            }
        };
    }
})();
''';

class Lz4Decoder {
    var _buffer : Uint8Array;
    var _pos : int;
    var _descriptor : Lz4Descriptor;
    var _state : int;
    var _notEnoughData : boolean;
    var _descriptorStart : int;
    var _streamSize : number[]; // 64bit number => 32bit number 2 elements array
    var _dictId : variant;
    var _currentStreamChecksum : ArrayBufferXXH;
    var _dataBlock : Uint8Array;
    var _uncompressed : ArrayBuffer;
    var _dataBlockSize : int;
    var _skippableSize : int;

    function constructor() {
        this._buffer = null;
        this._pos = 0;
        this._descriptor = null;
        this._state = Lz4Static.STATES.MAGIC;
        this._notEnoughData = false;
        this._descriptorStart = 0; 
        this._streamSize = null;
        this._dictId = null;
        this._currentStreamChecksum = null;
        this._dataBlockSize = 0;
        this._skippableSize = 0;
    }

    function decode(data : ArrayBuffer) : ArrayBuffer {
        /*if (this._skippableSize > 0) {
            this._skippableSize -= data.length;
            if (this._skippableSize > 0) {
                return;
            }
        }*/
        this._buffer = new Uint8Array(data);
        this._main();
        return this._uncompressed;
    }

    function _emit_Error(msg : string) : void {
        throw new Error(msg + ' @' + this._pos as string);
    }

    function _check_Size(n : int) : boolean {
        var delta = this._buffer.length - this._pos;
        if (delta <= 0 || delta < n) {
            if (this._notEnoughData) {
                this._emit_Error('Unexpected end of LZ4 stream');
            }
            return true;
        }

        this._pos += n;
        return false;
    }

    function _main() : void {
        var pos = this._pos;
        var notEnoughData = false;

        while ( !notEnoughData && this._pos < this._buffer.length ) {
            if (this._state == Lz4Static.STATES.MAGIC) {
                notEnoughData = this._read_MagicNumber();
            }

            if (this._state == Lz4Static.STATES.SKIP_SIZE) {
                notEnoughData = this._read_SkippableSize();
            }

            if (this._state == Lz4Static.STATES.DESCRIPTOR) {
                notEnoughData = this._read_Descriptor();
            }

            if (this._state == Lz4Static.STATES.SIZE) {
                notEnoughData = this._read_Size();
            }

            if (this._state == Lz4Static.STATES.DICTID) {
                notEnoughData = this._read_DictId();
            }

            if (this._state == Lz4Static.STATES.DESCRIPTOR_CHECKSUM) {
                notEnoughData = this._read_DescriptorChecksum();
            }

            if (this._state == Lz4Static.STATES.DATABLOCK_SIZE) {
                notEnoughData = this._read_DataBlockSize();
            }

            if (this._state == Lz4Static.STATES.DATABLOCK_DATA) {
                notEnoughData = this._read_DataBlockData();
            }

            if (this._state == Lz4Static.STATES.DATABLOCK_CHECKSUM) {
                notEnoughData = this._read_DataBlockChecksum();
            }

            if (this._state == Lz4Static.STATES.DATABLOCK_UNCOMPRESS) {
                notEnoughData = this._uncompress_DataBlock();
            }

            if (this._state == Lz4Static.STATES.EOS) {
                notEnoughData = this._read_EOS();
            }
        }

        if (this._pos > pos) {
            this._buffer = this._buffer.subarray(this._pos, this._buffer.length);
            this._pos = 0;
        }
    }

    function _read_MagicNumber() : boolean {
        var pos = this._pos;
        if (this._check_Size(Lz4Static.SIZES.MAGIC)) {
            return true;
        }

        var magic = Lz4Util.readInt32LE(this._buffer, pos);

        // Skippable chunk
        if ((magic & 0xFFFFFFF0) == Lz4Static.MAGICNUMBER_SKIPPABLE) {
            this._state = Lz4Static.STATES.SKIP_SIZE;
            return false;
        }

        // LZ4 stream
        if (magic != Lz4Static.MAGICNUMBER) {
            this._pos = pos;
            this._emit_Error('Invalid magic number: ' + magic.toString(16).toUpperCase());
            return true;
        }
        this._state = Lz4Static.STATES.DESCRIPTOR;
        return false;
    }

    function _read_SkippableSize() : boolean {
        var pos = this._pos;
        if (this._check_Size(Lz4Static.SIZES.SKIP_SIZE)) {
            return true;
        }
        this._state = Lz4Static.STATES.SKIP_DATA;
        this._skippableSize = Lz4Util.readInt32LE(this._buffer, pos);
        return false;
    }

    function _read_Descriptor() : boolean {
        // Flags
        var pos = this._pos;
        if (this._check_Size(Lz4Static.SIZES.DESCRIPTOR)) {
            return true;
        }

        this._descriptorStart = pos;

        // version
        var descriptor_flg = this._buffer[pos];
        var version = descriptor_flg >> 6;
        if (version != Lz4Static.VERSION) {
            this._pos = pos;
            this._emit_Error('Invalid version: ' + version + ' != ' + Lz4Static.VERSION);
            return true;
        }

        // flags
        // reserved bit should not be set
        if ( (descriptor_flg >> 1) & 0x1 ) {
            this._pos = pos;
            this._emit_Error('Reserved bit set');
            return true;
        }

        var blockMaxSizeIndex = (this._buffer[pos+1] >> 4) & 0x7;
        var blockMaxSize = Lz4Static.blockMaxSizes[blockMaxSizeIndex];
        if (blockMaxSize == null) {
            this._pos = pos;
            this._emit_Error('Invalid block max size: ' + blockMaxSizeIndex);
            return true;
        }

        this._descriptor = new Lz4Descriptor();
        this._descriptor.blockIndependence = ((descriptor_flg >> 5) & 0x1) as boolean;
        this._descriptor.blockChecksum = ((descriptor_flg >> 4) & 0x1) as boolean;
        this._descriptor.blockMaxSize = blockMaxSize;
        this._descriptor.streamSize = ((descriptor_flg >> 3) & 0x1) as boolean;
        this._descriptor.streamChecksum = ((descriptor_flg >> 2) & 0x1) as boolean;
        this._descriptor.dict = (descriptor_flg & 0x1) as boolean;
        this._descriptor.dictId = 0;

        this._state = Lz4Static.STATES.SIZE;
        return false;
    }

    function _read_Size() : boolean {
        if (this._descriptor.streamSize) {
            var pos = this._pos;
            if (this._check_Size(Lz4Static.SIZES.SIZE)) {
                return true;
            }
            //TODO max size is unsigned 64 bits
            this._streamSize = [Lz4Util.readInt32LE(this._buffer, pos), Lz4Util.readInt32LE(this._buffer, pos + 4)];
        }

        this._state = Lz4Static.STATES.DICTID;
        return false;
    }

    function _read_DictId() : boolean {
        if (this._descriptor.dictId) {
            var pos = this._pos;
            if (this._check_Size(Lz4Static.SIZES.DICTID)) {
                return true;
            }
            this._dictId = Lz4Util.readInt32LE(this._buffer, pos);
        }

        this._state = Lz4Static.STATES.DESCRIPTOR_CHECKSUM;
        return false;
    }

    function _read_DescriptorChecksum() : boolean {
        var pos = this._pos;
        if (this._check_Size(Lz4Static.SIZES.DESCRIPTOR_CHECKSUM)) {
            return true;
        }

        var checksum = this._buffer[pos];
        var currentChecksum = Lz4Util.descriptorChecksum(this._buffer.subarray(this._descriptorStart, pos));
        if (currentChecksum != checksum) {
            this._pos = pos;
            this._emit_Error('Invalid stream descriptor checksum');
            return true;
        }

        this._state = Lz4Static.STATES.DATABLOCK_SIZE;
        return false;
    }

    function _read_DataBlockSize() : boolean {
        var pos = this._pos;
        if (this._check_Size(Lz4Static.SIZES.DATABLOCK_SIZE)) {
            return true;
        }
        var datablock_size = Lz4Util.readInt32LE(this._buffer, pos);
        // Uncompressed
        if (datablock_size == Lz4Static.EOS) {
            this._state = Lz4Static.STATES.EOS;
            return false;
        }

    // if (datablock_size > this._descriptor.blockMaxSize) {
    // 	this._emit_Error( 'ASSERTION: invalid datablock_size: ' + datablock_size.toString(16).toUpperCase() + ' > ' + this._descriptor.blockMaxSize.toString(16).toUpperCase() )
    // }
        this._dataBlockSize = datablock_size;
        this._state = Lz4Static.STATES.DATABLOCK_DATA;
        return false;
    }

    function _read_DataBlockData() : boolean {
        var pos = this._pos;
        var datablock_size = this._dataBlockSize;
        if (datablock_size & 0x80000000) {
            // Uncompressed size
            datablock_size = datablock_size & 0x7FFFFFFF;
        }
        if (this._check_Size(datablock_size)) {
            return true;
        }
        this._dataBlock = this._buffer.subarray(pos, pos + datablock_size);
        this._state = Lz4Static.STATES.DATABLOCK_CHECKSUM;
        return false;
    }

    function _read_DataBlockChecksum() : boolean {
        var pos = this._pos;
        if (this._descriptor.blockChecksum) {
            if (this._check_Size(Lz4Static.SIZES.DATABLOCK_CHECKSUM)) {
                return true;
            }
            var checksum = Lz4Util.readInt32LE(this._buffer, this._pos-4);
            var currentChecksum = Lz4Util.blockChecksum(this._dataBlock);
            if (currentChecksum != checksum) {
                this._pos = pos;
                this._emit_Error('Invalid block checksum');
                return true;
            }
        }

        this._state = Lz4Static.STATES.DATABLOCK_UNCOMPRESS;
        return false;
    }

    function _uncompress_DataBlock() : boolean {
        var uncompressed : ArrayBuffer;
        // uncompressed?
        if (this._dataBlockSize & 0x80000000) {
            uncompressed = this._dataBlock.buffer;
        } else {
            uncompressed = new ArrayBuffer(this._descriptor.blockMaxSize);
            var decodedSize = this._uncompress(this._dataBlock, uncompressed);
            if (decodedSize < 0) {
                this._emit_Error('Invalid data block: ' + (-decodedSize) as string);
                return true;
            }
            if (decodedSize < this._descriptor.blockMaxSize) {
                uncompressed = uncompressed.slice(0, decodedSize);
            }
        }
        this._dataBlock = null;
        this._uncompressed = uncompressed;

        // Stream checksum
        if (this._descriptor.streamChecksum) {
            this._currentStreamChecksum = Lz4Util.streamChecksum(uncompressed, this._currentStreamChecksum);
        }

        this._state = Lz4Static.STATES.DATABLOCK_SIZE;
        return false; 
    }

    function _read_EOS() : boolean {
        if (this._descriptor.streamChecksum) {
            var pos = this._pos;
            if (this._check_Size(Lz4Static.SIZES.EOS)) {
                return true;
            }
            var checksum = Lz4Util.readInt32LE(this._buffer, pos);
            if (checksum != Lz4Util.streamChecksum(this._currentStreamChecksum)) {
                this._pos = pos;
                this._emit_Error('Invalid stream checksum: ' + checksum.toString(16).toUpperCase());
                return true;
            }
        }

        this._state = Lz4Static.STATES.MAGIC;
        return false;
    }

    function _uncompress(input : Uint8Array, output : ArrayBuffer) : number {
        var sIdx = 0;
        var eIdx = (input.length - sIdx);
        var output8 = new Uint8Array(output);
        // Process each sequence in the incoming data
        for (var i = sIdx, n = eIdx, j = 0; i < n;) {
            var token = input[i++];

            // Literals
            var literals_length = (token >> 4);
            if (literals_length > 0) {
                // length of literals
                var l = literals_length + 240;
                while (l == 255) {
                    l = input[i++];
                    literals_length += l;
                }

                // Copy the literals
                var end = i + literals_length;
                while (i < end) {
                    output8[j++] = input[i++];
                }
                // End of buffer?
                if (i == n) {
                    return j;
                }
            }

            // Match copy
            // 2 bytes offset (little endian)
            var offset = input[i++] | (input[i++] << 8);

            // 0 is an invalid offset value
            if (offset == 0 || offset > j) {
                return -(i-2);
            }

            // length of match copy
            var match_length = (token & 0xf);
            var l = match_length + 240;
            while (l == 255) {
                l = input[i++];
                match_length += l;
            }

            // Copy the match
            _Memcpy.memcpy(output8, j, j - offset, match_length + 4);
            j += match_length + 4;
        }

        return j;
    }
}
