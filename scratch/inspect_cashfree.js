const { Cashfree } = require('cashfree-pg');
console.log('Cashfree keys:', Object.keys(Cashfree));
console.log('Is PGCreateOrder a function?', typeof Cashfree.PGCreateOrder);
console.log('Is PGOrderCreate a function?', typeof Cashfree.PGOrderCreate);
