const { Cashfree } = require('cashfree-pg');
console.log('Type of Cashfree:', typeof Cashfree);
console.log('Cashfree:', Cashfree);
for (let prop in Cashfree) {
    console.log(`Prop: ${prop}, Type: ${typeof Cashfree[prop]}`);
}
