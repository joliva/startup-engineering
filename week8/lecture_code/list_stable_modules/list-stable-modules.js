/*
  0. Motivation.

  Try executing this script at the command line:
  
    node list-stable-modules.js 

  The node.js documentation is partially machine-readable, and has
  "stability indexes" as described here, measuring the stability and
  reliability of each module on a 0 (deprecated) to 5 (locked) scale:

    http://nodejs.org/api/documentation.html#documentation_stability_index

  The main index of the node documentation is here:

     http://nodejs.org/api/index.json

  And here is a sample URL for the JSON version of a particular module's docs:

     http://nodejs.org/api/fs.json

  Our goal is to get the node documentation index JSON, list all modules,
  download the JSON for those modules in parallel, and finally sort and
  output the modules by their respective stabilities. To do this we'll use
  the async flow control library (github.com/caolan/async).

  As a preliminary, install the following packages at the command line:

     npm install underscore async request;

  Now let's get started.

*/
var uu = require('underscore');
var async = require('async');
var request = require('request');

/*
  1. Debugging utilities: save and log.

  When debugging code involving callbacks, it's useful to be able to save
  intermediate variables and inspect them in the REPL. Using the code below,
  if you set DEBUG = true, then at any point within a function you can put
  an invocation like this to save a variable to the global namespace:

     save(mod_data, 'foo')

  For example:

    function mod_urls2mod_datas(mod_urls, cb) {
      log(arguments.callee.name);
      save(mod_urls, 'foo');   // <------ Note the save function
      async.map(mod_urls, mod_url2mod_data, cb);
    }

  Then execute the final composed function, e.g. index_url2stability_to_names, or
  otherwise get mod_urls2mod_datas to execute. You can confirm that it
  has executed with the log(arguments.callee.name) command.

  Now, at the REPL, you can type this:

    > mod_urls = global._data.foo
  
  This gives you a data structure that you can explore in the REPL. This is
  invaluable when building up functions that are parsing through dirty data.

  Note that the DEBUG flag allows us to keep these log and save routines
  within the body of a function, while still disabling them globally by
  simply setting DEBUG = false. There are other ways to do this as well, but
  this particular example is already fairly complex and we wanted to keep
  the debugging part simple.
*/
var _data = {};
var DEBUG = false;
var log = function(xx) { 
    if(DEBUG) {
        console.log("%s at %s", xx, new Date());
    }
};
function save(inst, name) {
    if(DEBUG) { global._data[name] = inst; }
}

/* 
  NOTE: Skip to part 6 at the bottom and then read upwards. For
  organizational reasons we need to define pipeline functions from the last
  to the first, so that we can reference them all at the end in the
  async.compose invocation

  2. Parse module data to pull out stabilities.

  The mod_data2modname_stability function is very messy because the
  nodejs.org website has several different ways to record the stability of a
  module in the accompanying JSON.

  As for mod_datas2stability_to_names, that takes in the parsed data structure
  built from each JSON URL (like http://nodejs.org/api/fs.json) and 
  extracts the (module_name, stability) pairs into an object. The for
  loop groups names by stability into stability_to_names. Note that we use
  the convention of a_to_b for a dictionary that maps items of class a 
  to items of class b, and we use x2y for a function that computes items of type y to
  from items of type x. 

  The final stability_to_names data structure is the goal of this script
  and is passed to the final callback stability_to_names2console at
  the end of async.compose (see the very end of this file). 
*/
function mod_data2modname_stability(mod_data) {
    var crypto_regex = /crypto/;
    var stability_regex = /Stability: (\d)/;
    var name_regex = /doc\/api\/(\w+).markdown/;
    var modname = name_regex.exec(mod_data.source)[1];
    var stability;
    try {
        if(crypto_regex.test(modname)) {
            var stmp = stability_regex.exec(mod_data.modules[0].desc)[1];
            stability = parseInt(stmp, 10);
        }
        else if(uu.has(mod_data, 'stability')) {
            stability =  mod_data.stability;
        }
        else if(uu.has(mod_data, 'miscs')) {
            stability =  mod_data.miscs[0].miscs[1].stability;
        }
        else if(uu.has(mod_data, 'modules')) {
            stability = mod_data.modules[0].stability;
        }
        else if(uu.has(mod_data, 'globals')) {
            stability = mod_data.globals[0].stability;
        } else {
            stability = undefined;
        }
    }
    catch(e) {
        stability = undefined;
    }
    return {"modname": modname, "stability": stability};
}

function mod_datas2stability_to_names(mod_datas, cb) {
    log(mod_datas);
    log(arguments.callee.name);
    modname_stabilities = uu.map(mod_datas, mod_data2modname_stability);
    var stability_to_names = {};
    for(var ii in modname_stabilities) {
        var ms = modname_stabilities[ii];
        var nm = ms.modname;
        if(uu.has(stability_to_names, ms.stability)) {
            stability_to_names[ms.stability].push(nm);
        } else{
            stability_to_names[ms.stability] = [nm];
        }
    }
    cb(null, stability_to_names);
}

/* 
  3. Download module urls and convert JSON into internal data.

  Here, we have a function mod_url2mod_data which is identical to
  index_url2index_data, down to the JSON parsing. We keep it distinct for
  didactic purposes but we could easily make these into the same function.

  Note also the use of async.mapLimit to apply this function in parallel to
  all the mod_urls, and feed the result to the callback (which we can
  leave unspecified in this case due to how async.compose works).

  We use mapLimit for didactic purposes here, as 36 simultaneous downloads
  is well within the capacity of most operating systems. You can use ulimit
  -n to get one constraint (the number of simultaneous open filehandles in
  Ubuntu) and could parse that to dynamically set this limit on a given
  machine. You could also modify this to take a command line parameter.
*/
function mod_url2mod_data(mod_url, cb) {
    log(arguments.callee.name);
    var err_resp_body2mod_data = function(err, resp, body) {
        if(!err && resp.statusCode == 200) {
            var mod_data = JSON.parse(body);
            cb(null, mod_data);
        }
    };
    request(mod_url, err_resp_body2mod_data);
}

function mod_urls2mod_datas(mod_urls, cb) {
    log(arguments.callee.name);
    var NUM_SIMULTANEOUS_DOWNLOADS = 36; // Purely for illustration
    async.mapLimit(mod_urls, NUM_SIMULTANEOUS_DOWNLOADS, mod_url2mod_data, cb);
}

/* 
  4. Build module URLs (e.g. http://nodejs.org/api/fs.json) from the JSON
  data structure formed from http://nodejs.org/api/index.json.

  The internal modname2mod_url could be factored outside of this function,
  but we keep it internal for conceptual simplicity.
*/
function index_data2mod_urls(index_data, cb) {
    log(arguments.callee.name);
    var notUndefined = function(xx) { return !uu.isUndefined(xx);};
    var modnames = uu.filter(uu.pluck(index_data.desc, 'text'), notUndefined);
    var modname2mod_url = function(modname) {
        var modregex = /\[([^\]]+)\]\(([^\)]+).html\)/;
        var shortname = modregex.exec(modname)[2];
        return 'http://nodejs.org/api/' + shortname + '.json';
    };
    var mod_urls = uu.map(modnames, modname2mod_url);
    cb(null, mod_urls);
}

/* 
  5. Given the index_url (http://nodejs.org/api/index.json), pull 
  down the body and parse the JSON into a data structure (index_data).
 
  Note that we could factor out the internal function with some effort,
  but it's more clear to just have it take the callback as a closure.

  Note also that we define the function in the standard way rather than
  assigning it to a variable, so that we can do log(arguments.callee.name).
  This is useful to follow which async functions are being executed and
  when.

*/
function index_url2index_data(index_url, cb) {
    log(arguments.callee.name);
    var err_resp_body2index_data = function(err, resp, body) {
        if(!err && resp.statusCode == 200) {
            var index_data = JSON.parse(body);
            cb(null, index_data);
        }
    };
    request(index_url, err_resp_body2index_data);
}

/* 
  6. The primary workhorse async.compose (github.com/caolan/async#compose) 
     sets up the entire pipeline in terms of five functions:

     - stability_to_names2console    // Print modules ordered by stability to console
     - mod_datas2stability_to_names  // List of modules -> ordered by stability
     - mod_urls2mod_datas     // nodejs.org/api/MODULE.json -> List of module data
     - index_data2mod_urls    // Extract URLs of module documentation from index_data
     - index_url2index_data   // Get nodejs.org/api/index.json -> JSON index_data

  The naming convention here is a useful one, especially at the beginning of
  a program when working out the data flow.  Let's understand this in terms
  of the synchronous version, and then the async version.

  Understanding the synchronous version
  -------------------------------------
  If this was a synchronous program, we would conceptually call these
  functions in order like so:

    index_data = index_url2index_data(index_url)
    mod_urls = index_data2mod_urls(index_data)
    mod_datas = mod_urls2mod_datas(mod_urls)
    stability_to_names = mod_datas2stability_to_names(mod_datas)
    stability_to_names2console(stability_to_names)
  
  Or, if we did it all in one nested function call:

     stability_to_names2console(
      mod_datas2stability_to_names(
       mod_urls2mod_datas(
        index_data2mod_urls(
         index_url2index_data(index_url)))))

  That's a little verbose, so we could instead write it like this:

    index_url2console = compose(stability_to_names2console, 
                                mod_datas2stability_to_names,
                                mod_urls2mod_datas,
                                index_data2mod_urls,
                                index_url2index_data)
    index_url2console(index_url)

  This is a very elegant and powerful way to represent complex dataflows,
  from web crawlers to genome sequencing pipelines. In particular, this
  final composed function can be exposed via the exports command.

  Understanding the asynchronous version
  --------------------------------------
  The main difference between the synchronous and asynchronous versions is
  that the synchronous functions would each *return* a value on their last
  line, while the asynchronous functions do not directly return a value but
  instead pass the value directly to a callback. Specifically, every time
  you see this:

    function foo2bar(foo) {
        // Compute bar from foo, handling errors locally
        return bar;
    }
  
  You would replace it with this, where we pass in a callback bar2baz:

    function foo2bar(foo, bar2baz) {
        // Compute bar from foo
        // Pass bar (and any error) off to to the next function
        bar2baz(err, bar);
    }

  So to compose our five functions with callbacks, rather than do a
  synchronous compose, we use the async.compose function from the async
  library:

    https://github.com/caolan/async#compose

  The concept is that, like in the synchronous case, we effectively
  generate a single function index_url2console which represents
  the entire logic of the program, and then feed that index_url.

*/
function stability_to_names2console(err, stability_to_names) {
    log(arguments.callee.name);
    console.log(JSON.stringify(stability_to_names, null, 2));
}
var index_url2console = async.compose(mod_datas2stability_to_names,
                                      mod_urls2mod_datas,
                                      index_data2mod_urls,
                                      index_url2index_data);

var index_url = "http://nodejs.org/api/index.json";
index_url2console(index_url, stability_to_names2console);
