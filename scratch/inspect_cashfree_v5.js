const { Cashfree, CFEnvironment } = require('cashfree-pg');

Cashfree.XClientId = "test";
Cashfree.XClientSecret = "test";
Cashfree.XEnvironment = CFEnvironment.SANDBOX;

console.log('Cashfree keys after config:', Object.keys(Cashfree));
console.log('Cashfree.PGCreateOrder type:', typeof Cashfree.PGCreateOrder);

const cfInstance = new Cashfree();
console.log('Instance keys:', Object.keys(cfInstance));
console.log('Instance methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(cfInstance)));
