class Lz4Static {
    static const MAGICNUMBER : number = 0x184D2204;
    //static const MAGICNUMBER_BUFFER : ArrayBuffer = new ArrayBuffer(4);
    static const EOS : number = 0;
    //static const EOS_BUFFER : ArrayBuffer = new ArrayBuffer(4);
    static const VERSION : int = 1;
    static const MAGICNUMBER_SKIPPABLE : number = 0x184D2A50;
    static const blockMaxSizes = [null, null, null, null, 64<<10, 256<<10, 1<<20, 4<<20 ] : int[];
    static const extension : string = ".lz4";

    class STATES {
        static const MAGIC : int = 0;
        static const DESCRIPTOR : int = 1;
        static const SIZE : int = 2;
        static const DICTID : int = 3;
        static const DESCRIPTOR_CHECKSUM : int = 4;
        static const DATABLOCK_SIZE : int = 5;
        static const DATABLOCK_DATA : int = 6;
        static const DATABLOCK_CHECKSUM : int = 7;
        static const DATABLOCK_UNCOMPRESS : int = 8;
        static const DATABLOCK_COMPRESS : int = 9;
        static const CHECKSUM : int = 10;
        static const CHECKSUM_UPDATE : int = 11;
        static const EOS : int = 90;
        static const SKIP_SIZE : int = 101;
        static const SKIP_DATA : int = 102;
    }

    class SIZES {
        static const MAGIC : int = 4;
        static const DESCRIPTOR : int = 2;
        static const SIZE : int = 8;
        static const DICTID : int = 4;
        static const DESCRIPTOR_CHECKSUM : int = 1;
        static const DATABLOCK_SIZE : int = 4;
        static const DATABLOCK_CHECKSUM : int = 4;
        static const CHECKSUM : int = 4;
        static const EOS : int = 4;
        static const SKIP_SIZE : int = 4;
    }
}

