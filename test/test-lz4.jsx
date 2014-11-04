import "test-case.jsx";
import "lz4_decoder.jsx";
import "js/nodejs.jsx";
import "console.jsx";

native class Converter {
    static function convert(input : Buffer) : ArrayBuffer;
} = """
{
    convert: function (input) {
        return new Uint8Array(input).buffer;
    }
};
""";

class _Test extends TestCase
{
    function test_sample() : void
    {
        var original = Converter.convert(node.fs.readFileSync(node.__dirname + "/test/orig.txt"));
        var input = Converter.convert(node.fs.readFileSync(node.__dirname + "/test/hc.lz4"));
        var obj = new Lz4Decoder();
        var output = obj.decode(input);
        this.expect(output.byteLength).toBe(original.byteLength);
        var uoutput = new Uint8Array(output);
        var uoriginal = new Uint8Array(original);
        for (var i = 0; i < uoutput.length; i++) {
            this.expect(uoutput[i]).toBe(uoriginal[i]);
        }
        //this.expect(obj.greeting()).toBe("Hello World");
    }
}
