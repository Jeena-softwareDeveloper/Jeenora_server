const CashfreeModule = require('cashfree-pg');
console.log('CFEnvironment:', CashfreeModule.CFEnvironment);
if (CashfreeModule.CFEnvironment) {
    console.log('SANDBOX:', CashfreeModule.CFEnvironment.SANDBOX);
    console.log('PRODUCTION:', CashfreeModule.CFEnvironment.PRODUCTION);
}
