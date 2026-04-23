const axios = require('axios');

async function test() {
    try {
        const response = await axios.get('http://localhost:5000/api/v1/wear/home/customer/ai/personalized-recommendations');
        console.log('Response Status:', response.status);
    } catch (error) {
        if (error.response) {
            console.log('Error Status:', error.response.status);
        } else {
            console.log('Error Message:', error.message);
        }
    }
}

test();
