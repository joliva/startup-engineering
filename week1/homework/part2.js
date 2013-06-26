#!/usr/bin/env node

var fs = require('fs');
var outfile = "hw1_part2.txt";

var test_prime = function(n) {
	// only need to run through up to sqrt(n) primes to test n for primality
	for (var i=0, limit=Math.ceil(Math.sqrt(n)); i<limit; i++) {
		var quotient = n/primes[i];
		if (Math.floor(quotient) == quotient) {
			// prime[i] divides evenly into n - not prime
			return false
		}
	}

	return true;
}

var NUM_PRIMES = 100;

// seed primes array
var primes = [2];
var numPrimes = 1;

var candidate = 3;
while (numPrimes < NUM_PRIMES) {
	if (test_prime(candidate) === true) {

		// add new prime to array
		primes.push(candidate);
		numPrimes++;
	}

	candidate++;
}

var result = primes.join(',');
fs.writeFileSync(outfile, result);  
console.log("Script: " + __filename + "\nWrote: " + result + "\nTo: " + outfile);
