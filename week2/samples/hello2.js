#!/usr/bin/env node

var fs = require('fs');
var outfile = 'hello.txt';
var out = 'Modify this script to write out something different';

fs.writeFileSync(outfile, out);
