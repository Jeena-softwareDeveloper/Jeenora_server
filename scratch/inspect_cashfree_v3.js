const { Cashfree } = require('cashfree-pg');
console.log('Cashfree structure:', Cashfree);
console.log('Cashfree methods:', Object.getOwnPropertyNames(Cashfree));
console.log('Cashfree prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(Cashfree)));
