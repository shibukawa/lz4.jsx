lz4.jsx
===========================================

Synopsis
---------------

LZ4 decompress library for JSX

Code Example
---------------

### Use from JSX

```js
import "lz4_decoder.jsx";

class _Main {
    static function main(argv : string[]) : void
    {
        var input : ArrayBuffer;
        /*
         : initialize ArrayBuffer
         */

        var decoder = new Lz4Decoder();
        var output : ArrayBuffer = decoder.decode(input);
    }
}
```

Installation
---------------

```sh
$ npm install lz4.jsx
```

If you want to use this library from other JSX project, install like the following:

```sh
$ npm install lz4.jsx --save-dev
```

API Reference
------------------

### class Lz4Decoder

#### function (input : ArrayBuffer) : ArrayBuffer

Development
-------------

## JSX

Don't be afraid [JSX](http://jsx.github.io)! If you have an experience of JavaScript, you can learn JSX
quickly.

* Static type system and unified class syntax.
* All variables and methods belong to class.
* JSX includes optimizer. You don't have to write tricky unreadalbe code for speed.
* You can use almost all JavaScript API as you know. Some functions become static class functions. See [reference](http://jsx.github.io/doc/stdlibref.html).

## Setup

To create development environment, call following command:

```sh
$ npm install
```

## Repository

* Repository: git://github.com/shibukawa/lz4.jsx.git
* Issues: https://github.com/shibukawa/lz4.jsx/issues

## Run Test

```sh
$ grunt test
```

## Build

```sh
$ grunt build
```

## Generate API reference

```sh
$ grunt doc
```

Author
---------

* shibukawa.yoshiki / shibukawa.yoshiki@gmail.com

License
------------

Modified BSD License (BSD 3-clause)

Complete license is written in `LICENSE.md`.
