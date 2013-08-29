/*
   Illustrative example to compare synchronous and asynchronous code.

   We demonstrate in particular that synchronous code has a running time
   that scales with the sum of individual running times during the parallel
   section of the code, while the equivalent async code scales with the
   maximum (and thus can be much faster).

   We also show examples with OOOP (via Timer) and FP (via build_insts).

   To install libraries:

     npm install async underscore sleep
*/
var async = require('async');
var uu = require('underscore');
var sleep = require('sleep');


/*
   Illustrates simple object-oriented programming style with JS. No
   inheritance here or need for prototype definitions; instead, a fairly
   self explanatory constructor for a simple object with some methods.

   As shown below, we pass new Timer instances into asynchronous code via
   closures so that they can track timings across the boundaries of async
   invocations.
*/
var Timer = function(name) {
    return {
        name: name,
        tstart: null,
        tend: null,
        dt: null,
        start: function() {
            this.tstart = new Date();
            console.log("%s start at %s", this.name, this.tstart);
        },
        end: function() {
            this.tend = new Date();
            console.log("%s end at %s", this.name, this.tend);
        },
        elapsed: function() {
            this.end();
            this.dt = this.tend.valueOf() - this.tstart.valueOf();
            console.log("%s elapsed time: %s ms", this.name, this.dt);
        }
    };
};

/*
   Illustrates the functional programming (FP) style.

   We create a set of dummy URLs by using underscore's map and range
   functions.

   Then we create a set of delays, in milliseconds, to use consistently
   across both the sync and async implementations.

   Finally, we use underscore's zip function () a few times to help
   us create a final data structure that looks like this:

    [ { url: 'http://www.bing.com/search?q=0',
        delay_ms: 860.4143052361906 },
      { url: 'http://www.bing.com/search?q=1',
        delay_ms: 91.59809700213373 },
      { url: 'http://www.bing.com/search?q=2',
        delay_ms: 695.1153050176799 },
      { url: 'http://www.bing.com/search?q=3',
        delay_ms: 509.67361335642636 },
      { url: 'http://www.bing.com/search?q=4',
        delay_ms: 410.48733284696937 } ]

   The reason we like a list of objects like this is that each individual
   element can be passed to a single argument function in a map invocation,
   which can then access the object's fields and do computations on it.
*/
var build_insts = function(nn) {
    var bingit = function(xx) { return 'http://www.bing.com/search?q=' + xx;};
    var urls = uu.map(uu.range(nn), bingit);
    var delays_ms = uu.map(uu.range(nn), function() { return Math.random() * 1000;});
    var to_inst = function(url_delay_pair) {
        return uu.object(uu.zip(['url', 'delay_ms'], url_delay_pair));
    };
    return uu.map(uu.zip(urls, delays_ms), to_inst);
};

/*
   Simple code that uses underscore's reduce to define a sum function.
   As we'll see, synchronous code scales with the sum of times while
   async code scales with the max.

*/
var summarize = function(results) {
    var add = function(aa, bb) { return aa + bb;};
    var sum = function(arr) { return uu.reduce(arr, add);};
    console.log("Sum of times: %s ms", sum(results));
    console.log("Max of times: %s ms", uu.max(results));
};

/*
    A straightforward synchronous function that imitates (mocks) the
    functionality of downloading a URL. We take in an inst object of the
    form:

      inst =  { url: 'http://www.bing.com/search?q=1',
                delay_ms: 91.59809700213373 }

    For illustrative simplicity, we fake downloading the URL here by simply
    doing a synchronous sleep with the sleep.usleep function. That is, we
    halt the process for delay_us seconds. The reason we do a fake download
    is that this way we can do an apples-to-apples comparison of an async
    version of the code in which each download took exactly the same time.

    We add two spaces to the beginning of the Timer invocation for
    formatting purposes in STDOUT, like indenting code.
*/
var synchronous_mock_download = function(inst) {
    var tm = new Timer('  ' + inst.url);
    tm.start();
    var delay_us = inst.delay_ms * 1000;
    sleep.usleep(delay_us);
    tm.elapsed();
    return inst.delay_ms;
};

/*
    A straightforward synchronous way to start a time, iterate over a bunch
    of URLs, download the files to disk, accumulate the times required to
    download those files, summarize the results and then stop the timer.
*/
var synchronous_example = function(insts) {
    var tm = new Timer('Synchronous');
    tm.start();
    var results = [];
    for(var ii = 0; ii < insts.length; ii++) {
        results.push(synchronous_mock_download(insts[ii]));
    }
    summarize(results);
    tm.elapsed();
};


/*
   Functionally identical to synchronous_example, this version is
   written to be structurally more similar to asynchronous_example
   for comparative purposes. Note that the loop is replaced with a
   map invocation and sent directly to summarize, which is
   the equivalent of a callback (i.e. directly acting on the results
   of another function).
*/
var synchronous_example2 = function(insts) {
    var tm = new Timer('Synchronous');
    tm.start();
    summarize(uu.map(insts, synchronous_mock_download));
    tm.elapsed();
};

/*
    Like ths synchronous_mock_download, we start the timer at the beginning.
    However, for the async version, we do the following:

    First, we replace the return statement by a callback invocation. Normally
    null would be an error message but we're not doing any error checking here
    just yet.

         return inst.delay_ms -> cb(null, inst.delay_ms)

    Then we pull the tm.elapsed() call into the delay function. It is exactly
    this call (along with the callback) which is delayed by inst.delay_ms in the
    setTimeout.

    The big difference from the synchronous_mock_download function is that
    we need to explicitly engineer certain lines of code to complete before
    other lines of code.
*/
var asynchronous_mock_download = function(inst, cb) {
    var tm = new Timer('  ' + inst.url);
    tm.start();
    var delayfn = function() {
        tm.elapsed();
        cb(null, inst.delay_ms);
    };
    setTimeout(delayfn, inst.delay_ms);
};

/*
    Restructures the synchronous_example2 to be asynchronous.  Note that the
    whole trick is in structuring code such that you ensure that certain
    lines occur after other lines - e.g. tm.elapsed() should not occur
    before summarize(results) can occur.
*/
var asynchronous_example = function(insts) {
    var tm = new Timer('Asynchronous');
    tm.start();

    var async_summarize = function(err, results) {
        summarize(results);
        tm.elapsed();
    };

    async.map(insts, asynchronous_mock_download, async_summarize);
};


/*
   Finally, the main routine itself is just a simple wrapper that
   we use to group and isolate code.
*/
var main = function() {
    var nn = 5;
    var insts = build_insts(nn);
    synchronous_example(insts);
    asynchronous_example(insts);
};

main();
