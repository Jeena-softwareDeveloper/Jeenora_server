const mongoose = require('mongoose');
const customerOrder = require('../models/wear/customerOrder');
const { dbConnect } = require('../utiles/db');
require('dotenv').config();

const userId = '69e103d3ae283ad1527cee45';

async function checkOrders() {
    await dbConnect();
    console.log('Searching for orders for user:', userId);
    
    const orders = await customerOrder.find({
        customerId: userId
    });
    
    console.log(`Found ${orders.length} orders (matching by string).`);

    const ordersObj = await customerOrder.find({
        customerId: new mongoose.Types.ObjectId(userId)
    });
    console.log(`Found ${ordersObj.length} orders (matching by ObjectId).`);
    orders.forEach(o => {
        console.log(`Order ID: ${o._id}, Total: ${o.price}, Status: ${o.delivery_status}`);
    });
    
    process.exit();
}

checkOrders().catch(err => {
    console.error(err);
    process.exit(1);
});
